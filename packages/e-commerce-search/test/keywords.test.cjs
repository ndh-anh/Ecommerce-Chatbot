const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const es = {};
const id = require.resolve("../src/config/elasticsearch.ts");
require.cache[id] = {
  id,
  filename: id,
  loaded: true,
  exports: { esClient: es },
};
const {
  keywordFields,
  suggestSearchKeywords,
  backfillKeywordSuggestions,
  ensureKeywordMapping,
} = require("../src/handlers/keywords.ts");
let calls;
beforeEach(() => {
  calls = [];
  es.search = async (request) => {
    calls.push(request);
    return { suggest: { keywords: [{ options: [] }] } };
  };
});

test("creates accent-free completion aliases with canonical Vietnamese keywords", () => {
  const fields = keywordFields({
    productName: "Áo polo cotton",
    categoryName: "Áo polo",
    brandName: "Đẹp",
  });
  assert.deepEqual(fields.searchKeywords, ["Áo polo", "Đẹp", "Áo polo cotton"]);
  assert.ok(fields.keyword_suggest.input.includes("ao polo"));
  assert.ok(fields.keyword_suggest.input.includes("dep"));
  assert.equal(
    keywordFields({ productName: "  Áo polo  ", categoryName: "ao polo" })
      .searchKeywords.length,
    1,
  );
  assert.equal(keywordFields({ productName: " " }).keyword_suggest, undefined);
});

test("runs completion only and deduplicates aliases while hiding tombstones", async () => {
  es.search = async (request) => {
    calls.push(request);
    return {
      suggest: {
        keywords: [
          {
            options: [
              { text: "ao polo", _source: { searchKeywords: ["Áo polo"] } },
              { text: "áo polo", _source: { searchKeywords: ["Áo polo"] } },
              {
                text: "ao cu",
                _source: { deleted: true, searchKeywords: ["Áo cũ"] },
              },
              { text: "ao thun", _source: { searchKeywords: ["Áo thun"] } },
            ],
          },
        ],
      },
    };
  };
  assert.deepEqual(await suggestSearchKeywords("  ÁO  ", 2), [
    "Áo polo",
    "Áo thun",
  ]);
  assert.equal(calls[0].suggest.keywords.prefix, "ao");
  assert.equal(calls[0].suggest.keywords.completion.skip_duplicates, true);
  assert.equal(calls[0].query, undefined);
  assert.equal(calls[0].knn, undefined);
});

test("does not query ES for empty or one-character input", async () => {
  assert.deepEqual(await suggestSearchKeywords(" "), []);
  assert.deepEqual(await suggestSearchKeywords("á"), []);
  assert.equal(calls.length, 0);
});

test("expands multiple matching keywords from a single completion document", async () => {
  es.search = async () => ({
    suggest: {
      keywords: [
        {
          options: [
            {
              text: "ao polo",
              _source: {
                searchKeywords: ["Áo polo", "Áo polo cotton", "Penguru"],
              },
            },
          ],
        },
      ],
    },
  });
  assert.deepEqual(await suggestSearchKeywords("ao", 6), [
    "Áo polo",
    "Áo polo cotton",
  ]);
});

test("adds completion mapping to an existing index without replacing it", async () => {
  es.indices = { putMapping: async (request) => calls.push(request) };
  await ensureKeywordMapping();
  assert.equal(calls[0].properties.keyword_suggest.type, "completion");
  assert.equal(calls[0].properties.keyword_suggest.analyzer, "standard");
});

test("backfill preserves vectors and external versions and tolerates concurrent newer events", async () => {
  const source = {
    productName: "Áo polo",
    product_vector: [0.1, 0.2],
    eventId: "e1",
  };
  es.search = async (request) => {
    calls.push(request);
    return {
      _scroll_id: "scroll1",
      hits: {
        hits: [
          { _id: "p1", _version: 100, _source: source },
          { _id: "p2", _version: 101, _source: source },
        ],
      },
    };
  };
  es.scroll = async () => ({ _scroll_id: "scroll2", hits: { hits: [] } });
  es.bulk = async (request) => {
    calls.push(request);
    return { items: [{ index: { status: 200 } }, { index: { status: 409 } }] };
  };
  es.indices = { refresh: async () => {} };
  es.clearScroll = async (request) => calls.push(request);
  assert.equal(await backfillKeywordSuggestions(), 1);
  const operations = calls[1].operations;
  assert.deepEqual(operations[0].index, {
    _index: "products",
    _id: "p1",
    version: 100,
    version_type: "external_gte",
  });
  assert.deepEqual(operations[1].product_vector, source.product_vector);
  assert.equal(operations[1].eventId, "e1");
  assert.equal(operations[1].keywordSuggestionsVersion, 1);
  assert.deepEqual(calls.at(-1), { scroll_id: "scroll2" });
  assert.deepEqual(calls[0].query.bool.must_not[1], {
    term: { keywordSuggestionsVersion: 1 },
  });
});

test("backfill reports write failures and still clears its scroll", async () => {
  es.search = async () => ({
    _scroll_id: "scroll1",
    hits: {
      hits: [{ _id: "p1", _version: 1, _source: { productName: "Áo" } }],
    },
  });
  es.bulk = async () => ({
    items: [{ index: { status: 503, error: { reason: "ES unavailable" } } }],
  });
  es.clearScroll = async (request) => calls.push(request);
  await assert.rejects(backfillKeywordSuggestions(), /ES unavailable/);
  assert.deepEqual(calls, [{ scroll_id: "scroll1" }]);
});
