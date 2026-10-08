const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const es = {};
let embeddings = 0;
function mockModule(path, exports) {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
mockModule("../src/config/elasticsearch.ts", { esClient: es });
mockModule("../src/config/model.ts", {
  getEmbedding: async () => {
    embeddings++;
    return [1];
  },
});
const {
  applyProductEvent,
  searchProducts,
} = require("../src/handlers/product.ts");
const {
  handleDelivery,
  confirmedSend,
  deadLetterQueue,
} = require("../src/rabbitmq.ts");
const base = {
  eventId: "e",
  aggregateType: "product",
  aggregateId: "p",
  eventType: "updated",
  eventVersion: 1000000000001,
  schemaVersion: 1,
  payload: {
    id: "p",
    name: "Product",
    is_published: true,
    product_variants: [{ price: "20" }, { price: "10" }],
  },
};
let writes;
beforeEach(() => {
  embeddings = 0;
  writes = [];
  es.get = async () => {
    throw { meta: { statusCode: 404 } };
  };
  es.index = async (doc) => {
    writes.push(doc);
  };
});
test("indexes minimum variant price with external version and visible marker", async () => {
  await applyProductEvent(base);
  assert.equal(writes[0].document.price, 10);
  assert.equal(writes[0].document.deleted, false);
  assert.equal(writes[0].version_type, "external");
  assert.equal(writes[0].version, base.eventVersion);
});
test("duplicates and stale updates skip embeddings and indexing", async () => {
  es.get = async () => ({ _version: base.eventVersion + 1 });
  await applyProductEvent(base);
  assert.equal(embeddings, 0);
  assert.equal(writes.length, 0);
});
test("deletion and unpublishing retain permanent versioned tombstones", async () => {
  await applyProductEvent({
    ...base,
    eventType: "deleted",
    payload: { productId: "p" },
  });
  await applyProductEvent({
    ...base,
    payload: { ...base.payload, is_published: false },
  });
  assert.equal(embeddings, 0);
  assert.equal(writes.length, 2);
  for (const write of writes) {
    assert.equal(write.document.deleted, true);
    assert.equal(write.version, base.eventVersion);
    assert.equal(write.document.productName, undefined);
  }
});
test("racing stale writes ignore only Elasticsearch version conflicts", async () => {
  es.index = async () => {
    throw {
      meta: {
        statusCode: 409,
        body: { error: { type: "version_conflict_engine_exception" } },
      },
    };
  };
  await applyProductEvent(base);
  es.index = async () => {
    throw { meta: { statusCode: 503 } };
  };
  await assert.rejects(applyProductEvent(base));
});
test("rejects unsupported envelopes and mismatching payloads", async () => {
  await assert.rejects(
    applyProductEvent({ ...base, eventVersion: 0 }),
    TypeError,
  );
  await assert.rejects(
    applyProductEvent({ ...base, payload: { ...base.payload, id: "other" } }),
    TypeError,
  );
  await assert.rejects(
    applyProductEvent({ ...base, schemaVersion: 2 }),
    TypeError,
  );
});
test("tombstones excluded from both lexical and vector search", async () => {
  let query;
  es.search = async (params) => {
    query = params;
    return { hits: { hits: [] } };
  };
  await searchProducts({ keyword: "Product" });
  assert.deepEqual(query.query.bool.filter[0], {
    bool: { must_not: [{ term: { deleted: true } }] },
  });
  assert.deepEqual(query.knn.filter, query.query.bool.filter);
});
function channels() {
  const consumer = Object.assign(new EventEmitter(), {
    acked: 0,
    closed: 0,
    ack() {
      this.acked++;
    },
    async close() {
      this.closed++;
    },
  });
  const publisher = Object.assign(new EventEmitter(), {
    sent: [],
    sendToQueue(queue, content, options, callback) {
      this.sent.push({ queue, content, options, callback });
      return false;
    },
  });
  return { consumer, publisher };
}
test("consumer acknowledges transient failures only after retry publish confirms", async () => {
  const { consumer, publisher } = channels();
  es.get = async () => {
    throw new Error("ES unavailable");
  };
  const work = handleDelivery(consumer, publisher, {
    content: Buffer.from(JSON.stringify(base)),
    properties: {},
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(consumer.acked, 0);
  assert.equal(publisher.sent[0].queue, "search_product_sync_queue.retry.5000");
  assert.equal(publisher.sent[0].options.headers["x-retry-count"], 1);
  publisher.sent[0].callback(null);
  await work;
  assert.equal(consumer.acked, 1);
});
test("invalid JSON and exhausted retries are confirmed into DLQ", async () => {
  for (const msg of [
    { content: Buffer.from("{"), properties: {} },
    {
      content: Buffer.from(JSON.stringify(base)),
      properties: { headers: { "x-retry-count": 3 } },
    },
  ]) {
    const { consumer, publisher } = channels();
    es.get = async () => {
      throw new Error("ES unavailable");
    };
    const work = handleDelivery(consumer, publisher, msg);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(publisher.sent[0].queue, deadLetterQueue);
    publisher.sent[0].callback(null);
    await work;
    assert.equal(consumer.acked, 1);
  }
});
test("failed retry transfer leaves the original unacked for broker redelivery", async () => {
  const { consumer, publisher } = channels();
  const work = handleDelivery(consumer, publisher, {
    content: Buffer.from("{"),
    properties: {},
  });
  await new Promise((resolve) => setImmediate(resolve));
  publisher.sent[0].callback(new Error("broker nack"));
  await work;
  assert.equal(consumer.acked, 0);
  assert.equal(consumer.closed, 1);
});
test("mandatory returned retry publish fails despite a later positive confirm", async () => {
  const { publisher } = channels();
  const sent = confirmedSend(publisher, "retry", Buffer.from("{}"), {});
  publisher.emit("return", {
    properties: { messageId: publisher.sent[0].options.messageId },
  });
  publisher.sent[0].callback(null);
  await assert.rejects(sent, /Unroutable/);
});
