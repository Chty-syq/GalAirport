/**
 * DeepSeek AI translation module.
 * Calls Rust backend which uses async-openai (OpenAI SDK) with DeepSeek endpoint.
 */

import { invoke } from "@tauri-apps/api/core";

/**
 * Translate a VN description to Chinese using DeepSeek via async-openai.
 * Caller is responsible for cleaning the text before passing it in.
 */
export async function translateDescription(
  text: string,
  apiKey: string
): Promise<string> {
  if (!text.trim() || !apiKey.trim()) return text;

  // Truncate very long descriptions to save tokens
  const truncated = text.length > 3000 ? text.slice(0, 3000) + "..." : text;

  const result = await invoke<string>("deepseek_translate", {
    apiKey,
    text: truncated,
  });

  return result;
}

/**
 * Check if an API key is valid by making a minimal test request.
 */
export async function testApiKey(apiKey: string): Promise<boolean> {
  try {
    return await invoke<boolean>("deepseek_test", { apiKey });
  } catch {
    return false;
  }
}

/**
 * Match VNDB English tags against a user-defined set of Chinese genre tags.
 * Returns only the genre tags that apply (zero or more).
 */
export async function matchGenreTags(
  vndbTags: string[],
  genreTags: string[],
  apiKey: string
): Promise<string[]> {
  if (!vndbTags.length || !genreTags.length || !apiKey.trim()) return [];
  try {
    return await invoke<string[]>("deepseek_match_tags", {
      apiKey,
      vndbTags,
      genreTags,
    });
  } catch {
    return [];
  }
}