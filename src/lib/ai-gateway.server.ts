import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

export function createAiProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "openai",
    baseURL: "https://api.openai.com/v1",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

export function createGoogleAiStudioProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "google-ai-studio",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

function isOpenAiQuotaError(error: unknown) {
  const text = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    text.includes("insufficient_quota") ||
    text.includes("quota") ||
    text.includes("billing") ||
    text.includes("credit") ||
    text.includes("429")
  );
}

type FallbackParams = {
  prompt: string;
  temperature?: number;
  openAiApiKey?: string;
  openAiModel?: string;
  googleApiKey?: string;
  googleModel?: string;
};

export async function generateTextWithFallback(params: FallbackParams) {
  const openAiModel = params.openAiModel ?? process.env.OPENAI_MODEL ?? "gpt-4o";
  const googleModel = params.googleModel ?? process.env.GOOGLE_MODEL ?? "gemini-2.0-flash";

  const openAiApiKey = params.openAiApiKey ?? process.env.OPENAI_API_KEY;
  const googleApiKey = params.googleApiKey ?? process.env.GOOGLE_AI_STUDIO_API_KEY ?? process.env.GOOGLE_API_KEY;

  if (!openAiApiKey && !googleApiKey) {
    throw new Error("Missing API keys: set OPENAI_API_KEY or GOOGLE_AI_STUDIO_API_KEY");
  }

  if (openAiApiKey) {
    try {
      const provider = createAiProvider(openAiApiKey);
      const { text } = await generateText({
        model: provider(openAiModel),
        prompt: params.prompt,
        temperature: params.temperature,
      });
      return { text, provider: "openai" as const, model: openAiModel };
    } catch (error) {
      if (!googleApiKey || !isOpenAiQuotaError(error)) {
        throw error;
      }
    }
  }

  if (!googleApiKey) {
    throw new Error("Missing GOOGLE_AI_STUDIO_API_KEY for fallback");
  }

  const provider = createGoogleAiStudioProvider(googleApiKey);
  const { text } = await generateText({
    model: provider(googleModel),
    prompt: params.prompt,
    temperature: params.temperature,
  });
  return { text, provider: "google-ai-studio" as const, model: googleModel };
}
