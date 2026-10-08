import * as amqp from "amqplib";
import {
  applyProductEvent,
  InvalidProductEventError,
} from "./handlers/product";

export const queueName = "search_product_sync_queue";
export const retryDelays = [5000, 30000, 120000];
export const deadLetterQueue = `${queueName}.dead`;
let reconnectTimer: NodeJS.Timeout | undefined;
let activeConnection: amqp.ChannelModel | undefined;
let stopped = false;

/** Confirm the replacement message before acknowledging its original delivery. */
export function confirmedSend(
  channel: amqp.ConfirmChannel,
  queue: string,
  content: Buffer,
  options: amqp.Options.Publish,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const messageId = crypto.randomUUID();
    const finish = (error?: Error | null) => {
      clearTimeout(timer);
      channel.off("return", onReturn);
      channel.off("close", onClose);
      error ? reject(error) : resolve();
    };
    const onReturn = (msg: amqp.Message) => {
      if (msg.properties.messageId === messageId)
        finish(new Error("Unroutable retry/DLQ message"));
    };
    const onClose = () => finish(new Error("Publisher channel closed"));
    const timer = setTimeout(
      () => finish(new Error("Publisher confirm timeout")),
      10000,
    );
    channel.on("return", onReturn);
    channel.on("close", onClose);
    try {
      channel.sendToQueue(
        queue,
        content,
        { ...options, messageId, persistent: true, mandatory: true },
        finish,
      );
    } catch (error) {
      finish(error as Error);
    }
  });
}

function waitUntil(channel: amqp.Channel, timestamp: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const close = () => {
      clearTimeout(timer);
      reject(new Error("Consumer disconnected"));
    };
    const timer = setTimeout(
      () => {
        channel.off("close", close);
        resolve();
      },
      Math.max(0, Math.min(timestamp - Date.now(), 120000)),
    );
    channel.once("close", close);
  });
}

/** Process a delivery, persisting bounded retries or a diagnostic dead letter on failure. */
export async function handleDelivery(
  channel: amqp.Channel,
  publisher: amqp.ConfirmChannel,
  msg: amqp.ConsumeMessage,
): Promise<void> {
  const headers = msg.properties.headers || {};
  const retry = Number.isInteger(headers["x-retry-count"])
    ? Math.max(0, headers["x-retry-count"])
    : 0;
  try {
    const due = Number(headers["x-not-before"] || 0);
    if (Number.isFinite(due) && due > Date.now()) await waitUntil(channel, due);
    await applyProductEvent(JSON.parse(msg.content.toString()));
    channel.ack(msg);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const invalid =
      error instanceof SyntaxError || error instanceof InvalidProductEventError;
    const delay = invalid ? undefined : retryDelays[retry];
    const target =
      delay === undefined ? deadLetterQueue : `${queueName}.retry.${delay}`;
    try {
      await confirmedSend(publisher, target, msg.content, {
        contentType: "application/json",
        headers: {
          ...headers,
          "x-retry-count": retry + 1,
          "x-not-before": delay === undefined ? 0 : Date.now() + delay,
          "x-last-error": reason.slice(0, 2000),
          "x-failed-at": new Date().toISOString(),
        },
      });
      channel.ack(msg);
      console.error(`Product event moved to ${target}: ${reason}`);
    } catch (forwardError) {
      // Keep the original unacked and reconnect; broker will redeliver it.
      console.error("Could not persist retry/DLQ message", forwardError);
      await channel.close().catch(() => undefined);
    }
  }
}

function scheduleReconnect() {
  if (stopped || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined;
    void initRabbitMQConsumer();
  }, 5000);
}

/** Reconnect after connection/channel loss and consume main plus durable delayed retry queues. */
export async function initRabbitMQConsumer() {
  if (stopped || activeConnection) return;
  let connection: amqp.ChannelModel | undefined;
  try {
    connection = await amqp.connect(
      process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672",
    );
    activeConnection = connection;
    connection.on("error", () =>
      console.error("RabbitMQ consumer connection error"),
    );
    connection.on("close", () => {
      if (activeConnection === connection) activeConnection = undefined;
      scheduleReconnect();
    });
    const channel = await connection.createChannel();
    const publisher = await connection.createConfirmChannel();
    for (const ch of [channel, publisher]) {
      ch.on("error", () => console.error("RabbitMQ consumer channel error"));
      ch.on("close", () => {
        void connection?.close().catch(() => undefined);
      });
    }
    await channel.assertExchange("product_events", "topic", { durable: true });
    await channel.assertQueue(queueName, { durable: true });
    await channel.bindQueue(queueName, "product_events", "product.#");
    await channel.assertQueue(deadLetterQueue, { durable: true });
    const queues = [
      queueName,
      ...retryDelays.map((delay) => `${queueName}.retry.${delay}`),
    ];
    for (const queue of queues)
      await channel.assertQueue(queue, { durable: true });
    await channel.prefetch(1);
    for (const queue of queues) {
      await channel.consume(queue, (msg) => {
        if (msg)
          void handleDelivery(channel, publisher, msg).catch((error) => {
            console.error("Consumer delivery failed", error);
            void connection?.close().catch(() => undefined);
          });
        else void connection?.close().catch(() => undefined);
      });
    }
    console.log("RabbitMQ product consumer ready");
  } catch {
    await connection?.close().catch(() => undefined);
    if (activeConnection === connection) activeConnection = undefined;
    console.error("RabbitMQ consumer connection failed; retrying in 5 seconds");
    scheduleReconnect();
  }
}

/** Close consumers on service shutdown; unacked deliveries remain in RabbitMQ. */
export async function stopRabbitMQConsumer() {
  stopped = true;
  clearTimeout(reconnectTimer);
  await activeConnection?.close().catch(() => undefined);
}
