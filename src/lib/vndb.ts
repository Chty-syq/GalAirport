/**
 * VNDB API v2 (Kana) client
 * Endpoint: https://api.vndb.org/kana
 * No API key required for read-only queries.
 */

const VNDB_API = "https://api.vndb.org/kana";

// ─── Types ─────────────────────────────────────────────────────

export interface VndbTitle {
  lang: string;       // e.g. "ja", "en", "zh-Hans", "zh-Hant"
  title: string;      // Title in original script
  latin: string | null; // Romanized version
  official: boolean;
  main: boolean;      // true for the entry's primary language (= olang)
}

export interface VndbVn {
  id: string;
  title: string;               // Default display title (romanized)
  alttitle: string | null;     // Alt title (original script)
  titles: VndbTitle[];         // All titles across languages
  released: string | null;
  image: VndbImage | null;
  screenshots: VndbImage[];    // game screenshots from VNDB
  olang: string;
  languages: string[];
  platforms: string[];
  rating: number | null;
  votecount: number;
  length_minutes: number | null;
  description: string | null;
  tags: VndbTag[];
  developers: VndbProducer[];
}

export interface VndbImage {
  id: string;
  url: string;
  dims: [number, number];
  sexual: number;
  violence: number;
}

export interface VndbTag {
  id: string;
  name: string;
  rating: number;
  spoiler: number;
  category: string;
}

export interface VndbProducer {
  id: string;
  name: string;
  original: string | null;
}

export interface VndbSearchResult {
  results: VndbVn[];
  more: boolean;
  count?: number;
}

// ─── Shared field list ─────────────────────────────────────────

const VN_FIELDS = [
  "title",
  "alttitle",
  "titles.lang",
  "titles.title",
  "titles.latin",
  "titles.official",
  "titles.main",
  "released",
  "image.id",
  "image.url",
  "image.dims",
  "image.sexual",
  "image.violence",
  "screenshots.id",
  "screenshots.url",
  "screenshots.dims",
  "screenshots.sexual",
  "screenshots.violence",
  "olang",
  "languages",
  "platforms",
  "rating",
  "votecount",
  "length_minutes",
  "description",
  "tags.id",
  "tags.name",
  "tags.rating",
  "tags.spoiler",
  "tags.category",
].join(",");

// ─── API Functions ─────────────────────────────────────────────

export async function searchVn(query: string, page = 1): Promise<VndbSearchResult> {
  const body = {
    filters: ["search", "=", query],
    fields: VN_FIELDS,
    sort: "searchrank",
    results: 10,
    page,
  };

  const resp = await fetch(`${VNDB_API}/vn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`VNDB API error (${resp.status}): ${text}`);
  }

  const data = await resp.json();

  const results: VndbVn[] = (data.results ?? []).map((vn: Record<string, unknown>) => ({
    ...vn,
    titles: vn.titles ?? [],
    screenshots: vn.screenshots ?? [],
    developers: [],
  }));

  return { results, more: data.more ?? false, count: data.count };
}

export async function getVnById(vnId: string): Promise<VndbVn | null> {
  const body = {
    filters: ["id", "=", vnId],
    fields: VN_FIELDS,
    results: 1,
  };

  const resp = await fetch(`${VNDB_API}/vn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) throw new Error(`VNDB API error (${resp.status})`);

  const data = await resp.json();
  if (!data.results || data.results.length === 0) return null;

  const vn = data.results[0];
  const developers = await fetchDevelopers(vnId);

  return { ...vn, titles: vn.titles ?? [], screenshots: vn.screenshots ?? [], developers };
}

async function fetchDevelopers(vnId: string): Promise<VndbProducer[]> {
  try {
    const body = {
      filters: ["and", ["vn", "=", ["id", "=", vnId]], ["official", "=", 1]],
      fields: "producers.id, producers.name, producers.original, producers.developer",
      results: 10,
    };

    const resp = await fetch(`${VNDB_API}/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) return [];
    const data = await resp.json();
    const devMap = new Map<string, VndbProducer>();

    for (const release of data.results ?? []) {
      for (const prod of release.producers ?? []) {
        if (prod.developer && !devMap.has(prod.id)) {
          devMap.set(prod.id, { id: prod.id, name: prod.name, original: prod.original });
        }
      }
    }
    return Array.from(devMap.values());
  } catch {
    return [];
  }
}

// ─── Title Selection ───────────────────────────────────────────

/**
 * Language preference order for picking the display title.
 * zh-Hans (简体) > zh-Hant (繁体) > zh (generic Chinese) > ja > en > default
 */
const LANG_PRIORITY: string[] = ["zh-Hans", "zh-Hant", "zh"];

/**
 * Pick the best Chinese title from the VN's titles array.
 * Returns null if no Chinese title is available.
 */
export function pickChineseTitle(titles: VndbTitle[]): string | null {
  for (const lang of LANG_PRIORITY) {
    const found = titles.find((t) => t.lang === lang);
    if (found) return found.title;
  }
  return null;
}

/**
 * Pick the best display title for our library.
 * Priority: Chinese title > VNDB default title
 */
export function pickDisplayTitle(vn: VndbVn): string {
  return pickChineseTitle(vn.titles ?? []) || vn.title;
}

/**
 * Pick the original (Japanese) title for the title_original field.
 * Falls back to alttitle or the main-language title.
 */
export function pickOriginalTitle(vn: VndbVn): string {
  // Try Japanese title first
  const ja = (vn.titles ?? []).find((t) => t.lang === "ja");
  if (ja) return ja.title;
  // Fallback to alttitle (which is typically original script)
  if (vn.alttitle) return vn.alttitle;
  // Fallback to the main language title
  const main = (vn.titles ?? []).find((t) => t.main);
  if (main) return main.title;
  return "";
}

// ─── Other Utilities ───────────────────────────────────────────

export function extractTags(tags: VndbTag[], maxSpoiler = 0, maxCount = 8): string[] {
  return tags
    .filter((t) => t.spoiler <= maxSpoiler && t.category !== "ero" && t.rating >= 1.5)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, maxCount)
    .map((t) => t.name);
}

export function formatVndbDate(date: string | null): string {
  if (!date || date === "TBA") return "";
  return date;
}

export function vndbRatingToLocal(rating: number | null): number {
  if (!rating) return 0;
  return Math.round(rating / 10);
}

export function cleanDescription(desc: string | null): string {
  if (!desc) return "";
  return desc
    .replace(/\[url=([^\]]*)\]([^\[]*)\[\/url\]/g, "$2")
    .replace(/\[spoiler\][\s\S]*?\[\/spoiler\]/g, "[剧透内容已隐藏]")
    .replace(/\[raw\]([\s\S]*?)\[\/raw\]/g, "$1")
    .replace(/\[code\]([\s\S]*?)\[\/code\]/g, "$1")
    .replace(/\[Edited from [^\]]*\]/gi, "")
    .replace(/\[From [^\]]*\]/gi, "")
    .trim();
}
