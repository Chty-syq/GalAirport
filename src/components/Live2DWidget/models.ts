export interface ModelDef {
  id: string;
  name: string;
  url: string;
  /** Cubism 2 等不支持的格式，设为 true 后禁用选择 */
  unsupported?: boolean;
}

export const MODEL_LIST: ModelDef[] = [
  { id: "Murasame",     name: "丛雨",       url: "/Murasame/Murasame.model3.json" },
  { id: "Nanami",       name: "七海奈奈美", url: "/Nanami/model0.json" },
  { id: "NeneAyachi",   name: "绫地宁宁",   url: "/NeneAyachi/model0.json" },
  { id: "KasuganoSora", name: "春日野穹",   url: "/KasuganoSora/model.json" },
];

export const DEFAULT_MODEL_ID = "Murasame";
