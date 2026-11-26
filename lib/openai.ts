import OpenAI from "openai";

export class MissingApiKeyError extends Error {
  constructor() {
    super("OpenAI API key is not configured.");
    this.name = "MissingApiKeyError";
  }
}

export function createOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new MissingApiKeyError();

  return new OpenAI({
    apiKey,
    // Default per-attempt ceiling. OpenAITryOnProvider passes a smaller
    // per-request timeout so every attempt fits the route's 300-second limit.
    // Image generation is expensive; retrying it can duplicate paid work and
    // make a request appear hung for several minutes.
    timeout: 165_000,
    maxRetries: 0,
  });
}
