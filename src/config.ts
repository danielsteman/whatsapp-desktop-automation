// @ts-ignore
import { load } from "jsr:@std/dotenv@0.225.5";

export interface Config {
  GEMINI_API_KEY: string;
  aiResponders: string[];
}

export async function loadConfig(): Promise<Config> {
  const env = await load();

  const geminiApiKey = env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY not found in .env file");
  }

  // Load AI responders configuration
  // @ts-expect-error - Deno global
  const aiRespondersConfig = await Deno.readTextFile(
    "./src/config/ai-responders.json"
  );
  const aiRespondersData = JSON.parse(aiRespondersConfig);

  return {
    GEMINI_API_KEY: geminiApiKey,
    aiResponders: aiRespondersData.aiResponders,
  };
}
