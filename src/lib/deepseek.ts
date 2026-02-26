/**
 * DeepSeek AI translation module.
 * Calls Rust backend which uses async-openai (OpenAI SDK) with DeepSeek endpoint.
 */

import { invoke } from "@tauri-apps/api/core";

/**
 * Strip VNDB formatting codes from description text before translation.
 */
function cleanVndbMarkup(text: string): string {
  return text
    .replace(/\[url=([^\]]*)\]([^\[]*)\[\/url\]/g, "$2")
    .replace(/\[spoiler\][\s\S]*?\[\/spoiler\]/g, "")
    .replace(/\[raw\]([\s\S]*?)\[\/raw\]/g, "$1")
    .replace(/\[code\]([\s\S]*?)\[\/code\]/g, "$1")
    .replace(/\[Edited from [^\]]*\]/gi, "")
    .replace(/\[From [^\]]*\]/gi, "")
    .trim();
}

/**
 * Translate a VN description to Chinese using DeepSeek via async-openai.
 */
export async function translateDescription(
  text: string,
  apiKey: string
): Promise<string> {
  if (!text.trim() || !apiKey.trim()) return text;

  const cleaned = cleanVndbMarkup(text);
  if (!cleaned) return "";

  // Truncate very long descriptions to save tokens
  const truncated = cleaned.length > 3000 ? cleaned.slice(0, 3000) + "..." : cleaned;

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
 * Translate an array of English tags to Chinese using DeepSeek.
 * Uses local cache: checks DB first, only calls API for uncached tags,
 * then stores results back to cache.
 */
export async function translateTags(
  tags: string[],
  apiKey: string
): Promise<string[]> {
  if (!tags.length) return tags;

  // 1. Check local cache
  const { getTagTranslations, setTagTranslations } = await import("@/lib/database");
  const cached = await getTagTranslations(tags);

  // 2. Split into cached vs uncached
  const uncached = tags.filter((t) => !cached.has(t));

  // 3. Translate uncached via DeepSeek (if API key and uncached tags exist)
  if (uncached.length > 0 && apiKey.trim()) {
    try {
      const translated = await invoke<string[]>("deepseek_translate_tags", {
        apiKey,
        tags: uncached,
      });

      // Store new translations to cache
      if (translated.length === uncached.length) {
        const pairs = uncached.map((en, i) => ({ en, zh: translated[i] }));
        await setTagTranslations(pairs);
        for (let i = 0; i < uncached.length; i++) {
          cached.set(uncached[i], translated[i]);
        }
      }
    } catch {
      // API failed — uncached tags stay English
    }
  }

  // 4. Return translated (cached) or original for each tag
  return tags.map((t) => cached.get(t) || t);
}