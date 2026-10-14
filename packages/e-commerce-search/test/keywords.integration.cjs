// Optional integration: use an isolated temporary index against a reachable ES 9 cluster.
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

async function runKeywordIntegration(source, configPath, moduleFilename) {
  const index = `codex_keyword_test_${randomUUID().replaceAll("-", "")}`;
  const { esClient } = require(configPath);
  const testModule = new Module(moduleFilename, module);
  testModule.filename = moduleFilename;
  testModule.paths = Module._nodeModulePaths(path.dirname(moduleFilename));
  // Exercise the actual compiled handler while redirecting every request to our test index.
  testModule._compile(
    source.replaceAll('"products"', JSON.stringify(index)),
    moduleFilename,
  );
  const {
    ensureKeywordMapping,
    backfillKeywordSuggestions,
    suggestSearchKeywords,
  } = testModule.exports;
  await esClient.indices.create({ index });
  try {
    await ensureKeywordMapping();
    const original = {
      productName: "Áo polo cotton",
      categoryName: "Áo polo",
      brandName: "Đẹp",
      deleted: false,
      eventId: "integration",
      product_vector: [0.1, 0.2],
    };
    await esClient.index({
      index,
      id: "p1",
      version: 100,
      version_type: "external",
      document: original,
      refresh: true,
    });
    assert.equal(await backfillKeywordSuggestions(), 1);
    const saved = await esClient.get({ index, id: "p1" });
    assert.equal(saved._version, 100);
    assert.deepEqual(saved._source.product_vector, original.product_vector);
    assert.equal(saved._source.eventId, original.eventId);
    const keywords = await suggestSearchKeywords("ao", 6);
    assert.ok(keywords.includes("Áo polo"), JSON.stringify(keywords));
    assert.ok(keywords.includes("Áo polo cotton"), JSON.stringify(keywords));
    assert.equal(new Set(keywords).size, keywords.length);
    assert.ok((await suggestSearchKeywords("dep", 6)).includes("Đẹp"));
    assert.equal(await backfillKeywordSuggestions(), 0);
    await esClient.index({
      index,
      id: "p1",
      version: 101,
      version_type: "external",
      document: { deleted: true },
      refresh: true,
    });
    assert.deepEqual(await suggestSearchKeywords("ao", 6), []);
    console.log(
      "ES integration passed: completion, Vietnamese aliases, idempotent backfill, preserved external version/vector and tombstone removal.",
    );
  } finally {
    await esClient.indices.delete({ index });
    await esClient.close();
  }
}

module.exports = { runKeywordIntegration };
if (require.main === module) {
  const filename = path.resolve(__dirname, "../dist/handlers/keywords.js");
  runKeywordIntegration(
    fs.readFileSync(filename, "utf8"),
    path.resolve(__dirname, "../dist/config/elasticsearch.js"),
    filename,
  ).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
