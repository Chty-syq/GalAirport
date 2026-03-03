import { createContext, useContext, useState, useEffect, useCallback } from "react";

export type Theme = "dark" | "light" | "midnight" | "forest" | "sakura" | "mocha";

export interface ThemeMeta {
  id: Theme;
  name: string;
  dark: boolean;
  /** Hex colors for the preview swatch (not dependent on CSS variables) */
  preview: {
    bg: string;
    sidebar: string;
    surface: string;
    accent: string;
    text: string;
  };
}

export const THEME_LIST: ThemeMeta[] = [
  {
    id: "dark",
    name: "暗夜",
    dark: true,
    preview: { bg: "#0c0b12", sidebar: "#12111b", surface: "#1b1929", accent: "#7a6af5", text: "#e4e2f4" },
  },
  {
    id: "light",
    name: "明亮",
    dark: false,
    preview: { bg: "#eeedf9", sidebar: "#f9f9fe", surface: "#e6e4f6", accent: "#5242d6", text: "#181630" },
  },
  {
    id: "midnight",
    name: "午夜蓝",
    dark: true,
    preview: { bg: "#090c19", sidebar: "#0f142a", surface: "#151e3e", accent: "#38b2f8", text: "#d6e2f8" },
  },
  {
    id: "forest",
    name: "森林",
    dark: true,
    preview: { bg: "#09100b", sidebar: "#0f1a11", surface: "#162519", accent: "#34ca66", text: "#d2eed6" },
  },
  {
    id: "sakura",
    name: "樱花",
    dark: false,
    preview: { bg: "#fbf4f8", sidebar: "#fefbfc", surface: "#f4e8f0", accent: "#d02658", text: "#2a0c1e" },
  },
  {
    id: "mocha",
    name: "摩卡",
    dark: false,
    preview: { bg: "#f7efe3", sidebar: "#fcf7f0", surface: "#eee4d4", accent: "#b25213", text: "#34200c" },
  },
];

const ALL_THEME_IDS = THEME_LIST.map((t) => t.id);

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
  cycleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

const STORAGE_KEY = "gm-theme";

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored && ALL_THEME_IDS.includes(stored)) return stored;
  } catch {}
  return "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const applyTheme = useCallback((t: Theme) => {
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {}
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeState((prev) => {
      const idx = ALL_THEME_IDS.indexOf(prev);
      return ALL_THEME_IDS[(idx + 1) % ALL_THEME_IDS.length];
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
