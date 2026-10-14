import { esClient } from "../config/elasticsearch";
import {
  ensureKeywordMapping,
  backfillKeywordSuggestions,
} from "../handlers/keywords";

async function main() {
  try {
    await ensureKeywordMapping();
    const count = await backfillKeywordSuggestions();
    console.log(`Added keyword suggestions to ${count} existing products.`);
  } finally {
    await esClient.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
