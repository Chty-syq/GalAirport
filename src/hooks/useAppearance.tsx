import { createContext, useContext, useState, useEffect, useCallback } from "react";

export type CardSize = "sm" | "md" | "lg" | "xl";
export type CardGap  = "sm" | "md" | "lg";

export interface AppearanceSettings {
  cardSize: CardSize;
  cardGap: CardGap;
}

export const CARD_SIZE_OPTIONS: { value: CardSize; label: string; px: number }[] = [
  { value: "sm", label: "小",   px: 148 },
  { value: "md", label: "中",   px: 180 },
  { value: "lg", label: "大",   px: 220 },
  { value: "xl", label: "超大", px: 270 },
];

export const CARD_GAP_OPTIONS: { value: CardGap; label: string; cls: string }[] = [
  { value: "sm", label: "紧凑", cls: "gap-2" },
  { value: "md", label: "适中", cls: "gap-4" },
  { value: "lg", label: "宽松", cls: "gap-6" },
];

const DEFAULTS: AppearanceSettings = { cardSize: "md", cardGap: "md" };
const STORAGE_KEY = "ga-appearance";

function load(): AppearanceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULTS;
}

interface CtxValue {
  appearance: AppearanceSettings;
  setAppearance: (patch: Partial<AppearanceSettings>) => void;
}

const Ctx = createContext<CtxValue>({
  appearance: DEFAULTS,
  setAppearance: () => {},
});

export function useAppearance() {
  return useContext(Ctx);
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearanceState] = useState<AppearanceSettings>(load);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance)); } catch {}
  }, [appearance]);

  const setAppearance = useCallback((patch: Partial<AppearanceSettings>) => {
    setAppearanceState((prev) => ({ ...prev, ...patch }));
  }, []);

  return <Ctx.Provider value={{ appearance, setAppearance }}>{children}</Ctx.Provider>;
}
