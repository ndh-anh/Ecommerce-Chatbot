import { esClient } from "../config/elasticsearch";

const MAX_KEYWORD_LENGTH = 150;
const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 10;

interface KeywordDocument {
  productName?: string;
  categoryName?: string;
  brandName?: string;
  deleted?: boolean;
  searchKeywords?: string[];
  [key: string]: unknown;
}

export function normalizeKeyword(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLocaleLowerCase("vi")
    .replace(/\s+/g, " ")
    .trim();
}

/** Index canonical terms plus accent-free aliases, retaining Vietnamese display text. */
export function keywordFields(product: KeywordDocument) {
  const seen = new Set<string>();
  const searchKeywords = [
    product.categoryName,
    product.brandName,
    product.productName,
  ]
    .filter((value): value is string => typeof value === "string")
    .map((value) =>
      value
        .replace(/[\u0000\u001e\u001f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_KEYWORD_LENGTH),
    )
    .filter((value) => {
      const key = normalizeKeyword(value);
      if (key.length < 2 || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const input = [
    ...new Set(
      searchKeywords.flatMap((term) => [
        term.toLocaleLowerCase("vi"),
        normalizeKeyword(term),
      ]),
    ),
  ];
  return {
    searchKeywords,
    keywordSuggestionsVersion: 1,
    ...(input.length ? { keyword_suggest: { input, weight: 1 } } : {}),
  };
}

/** Add fields to existing indices without closing them or replacing product mappings. */
export async function ensureKeywordMapping() {
  await esClient.indices.putMapping({
    index: "products",
    properties: {
      searchKeywords: { type: "keyword", index: false },
      keywordSuggestionsVersion: { type: "integer" },
      keyword_suggest: {
        type: "completion",
        analyzer: "standard",
        search_analyzer: "standard",
        max_input_length: MAX_KEYWORD_LENGTH,
      },
    },
  });
}

/** Keyword completion is independent of embeddings and document search. */
export async function suggestSearchKeywords(
  keyword: string,
  requestedLimit = DEFAULT_LIMIT,
): Promise<string[]> {
  const prefix = keyword.trim().replace(/\s+/g, " ");
  if (prefix.length < 2) return [];
  const limit = Math.max(
    1,
    Math.min(MAX_LIMIT, requestedLimit || DEFAULT_LIMIT),
  );
  const result = await esClient.search<KeywordDocument>(
    {
      index: "products",
      size: 0,
      _source: ["deleted", "searchKeywords"],
      suggest: {
        keywords: {
          prefix: normalizeKeyword(prefix),
          completion: {
            field: "keyword_suggest",
            size: limit * 4,
            skip_duplicates: true,
          },
        },
      },
    },
    { requestTimeout: 3000 },
  );
  const entries = result.suggest?.keywords as
    | Array<{ options: Array<{ text: string; _source?: KeywordDocument }> }>
    | undefined;
  const seen = new Set<string>();
  const suggestions: string[] = [];
  const normalizedPrefix = normalizeKeyword(prefix);
  for (const entry of entries ?? []) {
    for (const option of entry.options) {
      if (option._source?.deleted) continue;
      // Completion returns at most one matching input per document. Expand that
      // document's matching canonical terms so category/name can both be suggested.
      const candidates =
        option._source?.searchKeywords?.filter((term) =>
          normalizeKeyword(term).startsWith(normalizedPrefix),
        ) ?? [];
      if (!candidates.length)
        candidates.push(
          option._source?.searchKeywords?.find(
            (term) => normalizeKeyword(term) === normalizeKeyword(option.text),
          ) ?? option.text,
        );
      for (const display of candidates) {
        const key = normalizeKeyword(display);
        if (seen.has(key)) continue;
        seen.add(key);
        suggestions.push(display);
        if (suggestions.length >= limit) return suggestions;
      }
    }
  }
  return suggestions;
}

/** Fill existing documents without changing the external outbox version or generating vectors. */
export async function backfillKeywordSuggestions(): Promise<number> {
  let scrollId: string | undefined;
  let updated = 0;
  try {
    let page = await esClient.search<KeywordDocument>({
      index: "products",
      scroll: "2m",
      size: 200,
      version: true,
      query: {
        bool: {
          must_not: [
            { term: { deleted: true } },
            { term: { keywordSuggestionsVersion: 1 } },
          ],
        },
      },
    });
    scrollId = page._scroll_id;
    while (page.hits.hits.length) {
      const operations = page.hits.hits.flatMap((hit) => {
        if (!hit._source || !hit._id || hit._version === undefined) return [];
        return [
          {
            index: {
              _index: "products",
              _id: hit._id,
              version: hit._version,
              version_type: "external_gte" as const,
            },
          },
          { ...hit._source, ...keywordFields(hit._source) },
        ];
      });
      if (operations.length) {
        const result = await esClient.bulk({ operations });
        for (const item of result.items) {
          const outcome = item.index;
          if (outcome?.status === 409) continue; // A newer outbox event already supplied the fields.
          if (outcome?.error)
            throw new Error(`Keyword backfill failed: ${outcome.error.reason}`);
          updated++;
        }
      }
      if (!scrollId) break;
      const next = await esClient.scroll<KeywordDocument>({
        scroll_id: scrollId,
        scroll: "2m",
      });
      scrollId = next._scroll_id ?? scrollId;
      page = { ...page, hits: next.hits };
    }
    await esClient.indices.refresh({ index: "products" });
    return updated;
  } finally {
    if (scrollId) await esClient.clearScroll({ scroll_id: scrollId });
  }
}
