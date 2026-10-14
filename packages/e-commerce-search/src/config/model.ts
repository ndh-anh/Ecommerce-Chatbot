import OpenAI from "openai";

const qwenClient = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: "https://maas.qwencloudapi.com/compatible-mode/v1",
});

export async function getEmbedding(text: string): Promise<number[]> {
  const cleanedText = text.replace(/\n+/g, " ").trim();

  const response = await qwenClient.embeddings.create({
    model: "text-embedding-v3",
    input: cleanedText,
    dimensions: 1024,
    encoding_format: "float",
  });

  return response.data[0].embedding;
}
