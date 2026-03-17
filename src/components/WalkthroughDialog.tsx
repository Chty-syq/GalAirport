import { useState, useEffect, useRef } from "react";
import mermaid from "mermaid";
import { X, Edit, Wand2, Loader2, Save, AlertCircle, GitBranch, ArrowLeft, GitCommitHorizontal } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { Game } from "@/types/game";
import * as db from "@/lib/database";
import { useTheme, type Theme } from "@/hooks/useTheme";

// ─── Per-theme mermaid configuration ────────────────────────
interface MermaidThemeCfg {
  vars: Record<string, string>;
  /** CSS injected into the rendered SVG for shape-based coloring */
  svgCss: string;
  /** Radial gradient for the preview background */
  bg: string;
}

const MERMAID_THEMES: Record<Theme, MermaidThemeCfg> = {
  dark: {
    vars: {
      primaryColor: "#1e1240", primaryTextColor: "#ede9fe", primaryBorderColor: "#7c3aed",
      secondaryColor: "#17102e", secondaryTextColor: "#c4b5fd", secondaryBorderColor: "#6d28d9",
      tertiaryColor: "#0f0c1e", tertiaryTextColor: "#a78bfa", tertiaryBorderColor: "#5b21b6",
      lineColor: "#8b5cf6", edgeLabelBackground: "#17102e",
      background: "#0d0a1a", mainBkg: "#1e1240", nodeBorder: "#7c3aed",
      clusterBkg: "#17102e", clusterBorder: "#5b21b6",
      noteBkgColor: "#1e1240", noteTextColor: "#c4b5fd", noteBorderColor: "#7c3aed",
      titleColor: "#ede9fe", textColor: "#ede9fe", fontSize: "24px",
    },
    svgCss: `
      g.node > rect    { fill:#1e1240!important; stroke:#7c3aed!important; stroke-width:1.5px!important; filter:drop-shadow(0 0 6px rgba(124,58,237,.35)); }
      g.node > polygon { fill:#2a0f28!important; stroke:#ec4899!important; stroke-width:1.5px!important; filter:drop-shadow(0 0 6px rgba(236,72,153,.35)); }
      g.node > path    { fill:#0f1e3d!important; stroke:#60a5fa!important; stroke-width:1.5px!important; filter:drop-shadow(0 0 6px rgba(96,165,250,.35)); }
      g.node > circle  { fill:#0f2218!important; stroke:#34d399!important; stroke-width:1.5px!important; filter:drop-shadow(0 0 6px rgba(52,211,153,.4)); }
      .edgePath path.path { stroke:#8b5cf6!important; stroke-width:1.5px!important; }
      .edgePath marker path { fill:#8b5cf6!important; }
      .edgeLabel .label rect { fill:#17102e!important; stroke:#5b21b6!important; }
      .edgeLabel .label span { color:#c4b5fd!important; }
      g.node .label { color:#ede9fe!important; }`,
    bg: "radial-gradient(ellipse at 50% 0%, #1a1033 0%, #0d0a1a 70%)",
  },
  midnight: {
    vars: {
      primaryColor: "#0a1832", primaryTextColor: "#d6e2f8", primaryBorderColor: "#38b2f8",
      secondaryColor: "#0c1e3e", secondaryTextColor: "#93c5fd", secondaryBorderColor: "#2563eb",
      tertiaryColor: "#060e24", tertiaryTextColor: "#7eb2ff", tertiaryBorderColor: "#1e40af",
      lineColor: "#38b2f8", edgeLabelBackground: "#0c1e3e",
      background: "#090c19", mainBkg: "#0a1832", nodeBorder: "#38b2f8",
      clusterBkg: "#0c1e3e", clusterBorder: "#1e40af",
      noteBkgColor: "#0a1832", noteTextColor: "#93c5fd", noteBorderColor: "#38b2f8",
      titleColor: "#d6e2f8", textColor: "#d6e2f8", fontSize: "24px",
    },
    svgCss: `
      g.node > rect    { fill:#0a1832!important; stroke:#38b2f8!important; stroke-width:1.5px!important; filter:drop-shadow(0 0 6px rgba(56,178,248,.35)); }
      g.node > polygon { fill:#101040!important; stroke:#818cf8!important; stroke-width:1.5px!important; filter:drop-shadow(0 0 6px rgba(129,140,248,.35)); }
      g.node > path    { fill:#03102a!important; stroke:#67e8f9!important; stroke-width:1.5px!important; filter:drop-shadow(0 0 6px rgba(103,232,249,.35)); }
      g.node > circle  { fill:#06201a!important; stroke:#34d399!important; stroke-width:1.5px!important; filter:drop-shadow(0 0 6px rgba(52,211,153,.4)); }
      .edgePath path.path { stroke:#38b2f8!important; stroke-width:1.5px!important; }
      .edgePath marker path { fill:#38b2f8!important; }
      .edgeLabel .label rect { fill:#0c1e3e!important; stroke:#1e40af!important; }
      .edgeLabel .label span { color:#93c5fd!important; }
      g.node .label { color:#d6e2f8!important; }`,
    bg: "radial-gradient(ellipse at 50% 0%, #0f1e42 0%, #090c19 70%)",
  },
  forest: {
    vars: {
      primaryColor: "#0d2012", primaryTextColor: "#d2eed6", primaryBorderColor: "#34ca66",
      secondaryColor: "#101e0c", secondaryTextColor: "#86efac", secondaryBorderColor: "#15803d",
      tertiaryColor: "#061408", tertiaryTextColor: "#4ade80", tertiaryBorderColor: "#166534",
      lineColor: "#34ca66", edgeLabelBackground: "#101e0c",
      background: "#09100b", mainBkg: "#0d2012", nodeBorder: "#34ca66",
      clusterBkg: "#101e0c", clusterBorder: "#166534",
      noteBkgColor: "#0d2012", noteTextColor: "#86efac", noteBorderColor: "#34ca66",
      titleColor: "#d2eed6", textColor: "#d2eed6", fontSize: "24px",
    },
    svgCss: `
      g.node > rect    { fill:#0d2012!important; stroke:#34ca66!important; stroke-width:1.5px!important; filter:drop-shadow(0 0 6px rgba(52,202,102,.35)); }
      g.node > polygon { fill:#1c2a0c!important; stroke:#a3e635!important; stroke-width:1.5px!important; filter:drop-shadow(0 0 6px rgba(163,230,53,.35)); }
      g.node > path    { fill:#062018!important; stroke:#5eead4!important; stroke-width:1.5px!important; filter:drop-shadow(0 0 6px rgba(94,234,212,.35)); }
      g.node > circle  { fill:#152015!important; stroke:#86efac!important; stroke-width:1.5px!important; filter:drop-shadow(0 0 6px rgba(134,239,172,.4)); }
      .edgePath path.path { stroke:#34ca66!important; stroke-width:1.5px!important; }
      .edgePath marker path { fill:#34ca66!important; }
      .edgeLabel .label rect { fill:#101e0c!important; stroke:#166534!important; }
      .edgeLabel .label span { color:#86efac!important; }
      g.node .label { color:#d2eed6!important; }`,
    bg: "radial-gradient(ellipse at 50% 0%, #0d2a12 0%, #09100b 70%)",
  },
  light: {
    vars: {
      primaryColor: "#ede9fe", primaryTextColor: "#3b1fa8", primaryBorderColor: "#7c3aed",
      secondaryColor: "#f5f3ff", secondaryTextColor: "#5b21b6", secondaryBorderColor: "#a78bfa",
      tertiaryColor: "#faf9ff", tertiaryTextColor: "#7c3aed", tertiaryBorderColor: "#c4b5fd",
      lineColor: "#7c3aed", edgeLabelBackground: "#f5f3ff",
      background: "#eeedf9", mainBkg: "#ede9fe", nodeBorder: "#7c3aed",
      clusterBkg: "#f5f3ff", clusterBorder: "#a78bfa",
      noteBkgColor: "#ede9fe", noteTextColor: "#5b21b6", noteBorderColor: "#7c3aed",
      titleColor: "#18163a", textColor: "#18163a", fontSize: "24px",
    },
    svgCss: `
      g.node > rect    { fill:#ede9fe!important; stroke:#7c3aed!important; stroke-width:1.5px!important; filter:drop-shadow(0 0 4px rgba(124,58,237,.18)); }
      g.node > polygon { fill:#fce7f3!important; stroke:#db2777!important; stroke-width:1.5px!important; filter:drop-shadow(0 0 4px rgba(219,39,119,.18)); }
      g.node > path    { fill:#dbeafe!important; stroke:#2563eb!important; stroke-width:1.5px!important; filter:drop-shadow(0 0 4px rgba(37,99,235,.18)); }
      g.node > circle  { fill:#dcfce7!important; stroke:#16a34a!important; stroke-width:1.5px!important; filter:drop-shadow(0 0 4px rgba(22,163,74,.22)); }
      .edgePath path.path { stroke:#7c3aed!important; stroke-width:1.5px!important; }
      .edgePath marker path { fill:#7c3aed!important; }
      .edgeLabel .label rect { fill:#f5f3ff!important; stroke:#a78bfa!important; }
      .edgeLabel .label span { color:#5b21b6!important; }
      g.node .label { color:#18163a!important; }`,
    bg: "radial-gradient(ellipse at 50% 0%, #e8e4f8 0%, #f4f2fd 70%)",
  },
  sakura: {
    vars: {
      primaryColor: "#fce7f3", primaryTextColor: "#6b0e32", primaryBorderColor: "#d02658",
      secondaryColor: "#fdf2f8", secondaryTextColor: "#9d1754", secondaryBorderColor: "#ec4899",
      tertiaryColor: "#fef9fb", tertiaryTextColor: "#be185d", tertiaryBorderColor: "#f9a8d4",
      lineColor: "#d02658", edgeLabelBackground: "#fdf2f8",
      background: "#fbf4f8", mainBkg: "#fce7f3", nodeBorder: "#d02658",
      clusterBkg: "#fdf2f8", clusterBorder: "#f9a8d4",
      noteBkgColor: "#fce7f3", noteTextColor: "#9d1754", noteBorderColor: "#d02658",
      titleColor: "#2a0c1e", textColor: "#2a0c1e", fontSize: "24px",
    },
    svgCss: `
      g.node > rect    { fill:#fce7f3!important; stroke:#d02658!important; stroke-width:1.5px!important; filter:drop-shadow(0 0 4px rgba(208,38,88,.18)); }
      g.node > polygon { fill:#f5e6ff!important; stroke:#9333ea!important; stroke-width:1.5px!important; filter:drop-shadow(0 0 4px rgba(147,51,234,.18)); }
      g.node > path    { fill:#eff6ff!important; stroke:#3b82f6!important; stroke-width:1.5px!important; filter:drop-shadow(0 0 4px rgba(59,130,246,.18)); }
      g.node > circle  { fill:#fff7ed!important; stroke:#ea580c!important; stroke-width:1.5px!important; filter:drop-shadow(0 0 4px rgba(234,88,12,.22)); }
      .edgePath path.path { stroke:#d02658!important; stroke-width:1.5px!important; }
      .edgePath marker path { fill:#d02658!important; }
      .edgeLabel .label rect { fill:#fdf2f8!important; stroke:#f9a8d4!important; }
      .edgeLabel .label span { color:#9d1754!important; }
      g.node .label { color:#2a0c1e!important; }`,
    bg: "radial-gradient(ellipse at 50% 0%, #fce7f3 0%, #fdf4f8 70%)",
  },
  mocha: {
    vars: {
      primaryColor: "#fef3c7", primaryTextColor: "#4a2008", primaryBorderColor: "#b25213",
      secondaryColor: "#fde8d0", secondaryTextColor: "#7c3b0a", secondaryBorderColor: "#c2410c",
      tertiaryColor: "#fef9f0", tertiaryTextColor: "#92400e", tertiaryBorderColor: "#d97706",
      lineColor: "#b25213", edgeLabelBackground: "#fde8d0",
      background: "#f7efe3", mainBkg: "#fef3c7", nodeBorder: "#b25213",
      clusterBkg: "#fde8d0", clusterBorder: "#d97706",
      noteBkgColor: "#fef3c7", noteTextColor: "#7c3b0a", noteBorderColor: "#b25213",
      titleColor: "#34200c", textColor: "#34200c", fontSize: "24px",
    },
    svgCss: `
      g.node > rect    { fill:#fef3c7!important; stroke:#b25213!important; stroke-width:1.5px!important; filter:drop-shadow(0 0 4px rgba(178,82,19,.18)); }
      g.node > polygon { fill:#fde8d0!important; stroke:#c2410c!important; stroke-width:1.5px!important; filter:drop-shadow(0 0 4px rgba(194,65,12,.18)); }
      g.node > path    { fill:#e0f2fe!important; stroke:#0284c7!important; stroke-width:1.5px!important; filter:drop-shadow(0 0 4px rgba(2,132,199,.18)); }
      g.node > circle  { fill:#dcfce7!important; stroke:#15803d!important; stroke-width:1.5px!important; filter:drop-shadow(0 0 4px rgba(21,128,61,.22)); }
      .edgePath path.path { stroke:#b25213!important; stroke-width:1.5px!important; }
      .edgePath marker path { fill:#b25213!important; }
      .edgeLabel .label rect { fill:#fde8d0!important; stroke:#d97706!important; }
      .edgeLabel .label span { color:#7c3b0a!important; }
      g.node .label { color:#34200c!important; }`,
    bg: "radial-gradient(ellipse at 50% 0%, #f5e8d0 0%, #f9f2e6 70%)",
  },
};

mermaid.initialize({ startOnLoad: false, theme: "base", fontFamily: "system-ui, -apple-system, sans-serif", flowchart: { curve: "basis", padding: 20, diagramPadding: 24 } });

function enhanceSvg(svg: string, css: string): string {
  return svg.replace(/(<svg[^>]*>)/, `$1<style>${css}</style>`);
}

type Mode = "view" | "edit";
type LeftPanel = "code" | "ai";

interface Props {
  game: Game;
  onClose: () => void;
}

export function WalkthroughDialog({ game, onClose }: Props) {
  const { theme } = useTheme();
  const [mode, setMode] = useState<Mode>("view");
  const [leftPanel, setLeftPanel] = useState<LeftPanel>("code");
  const [code, setCode] = useState("");
  const [savedCode, setSavedCode] = useState("");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const renderIdRef = useRef(0);
  const codeTextareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const handleCodeScroll = () => {
    if (lineNumbersRef.current && codeTextareaRef.current) {
      lineNumbersRef.current.scrollTop = codeTextareaRef.current.scrollTop;
    }
  };

  useEffect(() => {
    db.getSetting(`walkthrough:${game.id}`).then((val) => {
      setCode(val ?? "");
      setSavedCode(val ?? "");
    });
  }, [game.id]);

  useEffect(() => {
    let cancelled = false;
    const container = previewRef.current;
    if (!code.trim()) {
      if (container) container.innerHTML = "";
      setRenderError(null);
      return () => { cancelled = true; };
    }
    const id = ++renderIdRef.current;
    const cfg = MERMAID_THEMES[theme];
    const timer = setTimeout(async () => {
      if (cancelled || !container) return;
      mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        themeVariables: cfg.vars,
        fontFamily: "system-ui, -apple-system, sans-serif",
        flowchart: { curve: "basis", padding: 20, diagramPadding: 24 },
      });
      try {
        const { svg } = await mermaid.render(`mm-${id}`, code);
        if (!cancelled && previewRef.current === container) {
          container.innerHTML = enhanceSvg(svg, cfg.svgCss);
          setRenderError(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          if (container) container.innerHTML = "";
          const msg = e instanceof Error ? e.message : String(e);
          setRenderError(msg.replace(/^Error:\s*/i, "").split("\n")[0]);
        }
      }
    }, mode === "view" ? 0 : 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, mode, theme]);

  const handleSave = async () => {
    setSaving(true);
    await db.setSetting(`walkthrough:${game.id}`, code);
    setSavedCode(code);
    setSaving(false);
  };

  // Keep ref up-to-date so the Ctrl+S effect always calls latest handleSave
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  useEffect(() => {
    if (mode !== "edit") return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveRef.current();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [mode]);

  const handleDiscardEdit = () => {
    setCode(savedCode);
    setMode("view");
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    const apiKey = await db.getSetting("deepseek_api_key");
    if (!apiKey) {
      setGenError("请先在「设置 → API 配置」中填写 DeepSeek API Key");
      return;
    }
    setGenerating(true);
    setGenError(null);
    try {
      const result = await invoke<string>("deepseek_generate_mermaid", {
        apiKey,
        prompt: prompt.trim(),
        gameTitle: game.title,
      });
      setCode(result);
      setLeftPanel("code"); // switch to code view to show result
    } catch (e) {
      setGenError(String(e));
    }
    setGenerating(false);
  };

  // ─── View mode ───────────────────────────────────────────────
  if (mode === "view") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 dialog-overlay backdrop-blur-sm" onClick={onClose} />
        <div key="view" className="relative w-full max-w-3xl bg-surface-1 border border-surface-3 rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "82vh" }}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-3 shrink-0">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold text-text-primary">攻略图</span>
              <span className="text-xs text-text-muted truncate max-w-[200px]">· {game.title}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMode("edit")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-surface-3 hover:bg-surface-4 text-text-secondary rounded-lg transition-colors"
              >
                <Edit className="w-3 h-3" />
                编辑
              </button>
              <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-surface-3 flex items-center justify-center transition-colors">
                <X className="w-4 h-4 text-text-secondary" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-6 min-h-0" style={{ background: MERMAID_THEMES[theme].bg }}>
            {!code.trim() ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3 text-text-muted">
                <GitCommitHorizontal className="w-10 h-10 opacity-20" />
                <p className="text-sm">暂无攻略图</p>
                <button onClick={() => setMode("edit")} className="text-xs text-accent hover:underline">
                  添加攻略图 →
                </button>
              </div>
            ) : renderError ? (
              <div className="flex items-start gap-2 p-3 bg-surface-2 rounded-lg text-xs border border-red-500/20">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <pre className="text-red-400 whitespace-pre-wrap break-all">{renderError}</pre>
              </div>
            ) : (
              <div ref={previewRef} className="flex items-start justify-center [&>svg]:max-w-full [&>svg]:h-auto" />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Edit mode (split layout) ─────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 dialog-overlay backdrop-blur-sm" onClick={onClose} />
      <div
        key="edit"
        className="relative w-full bg-surface-1 border border-surface-3 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxWidth: "1440px", height: "88vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDiscardEdit}
              className="w-7 h-7 rounded-lg hover:bg-surface-3 flex items-center justify-center transition-colors"
              title="返回"
            >
              <ArrowLeft className="w-4 h-4 text-text-secondary" />
            </button>
            <GitBranch className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold text-text-primary">编辑攻略图</span>
            <span className="text-xs text-text-muted truncate max-w-[180px]">· {game.title}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-accent hover:bg-accent-hover disabled:opacity-60 text-white rounded-lg transition-colors"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              保存
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-surface-3 flex items-center justify-center transition-colors">
              <X className="w-4 h-4 text-text-secondary" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left panel */}
          <div className="flex-1 flex flex-col border-r border-surface-3 min-w-0">
            {/* Switch */}
            <div className="px-3 py-2 border-b border-surface-3 shrink-0 flex items-center gap-1">
              <div className="flex items-center bg-surface-2 rounded-lg p-0.5 gap-0.5">
                <button
                  onClick={() => setLeftPanel("code")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    leftPanel === "code"
                      ? "bg-surface-4 text-text-primary"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  代码
                </button>
                <button
                  onClick={() => { setLeftPanel("ai"); setGenError(null); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    leftPanel === "ai"
                      ? "bg-surface-4 text-text-primary"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  <Wand2 className="w-3 h-3" />
                  AI 生成
                </button>
              </div>
            </div>

            {/* Panel content */}
            {leftPanel === "code" ? (
              <div className="flex flex-1 overflow-hidden min-h-0 bg-surface-0">
                {/* Line numbers */}
                <div
                  ref={lineNumbersRef}
                  className="shrink-0 overflow-hidden select-none pt-4 pb-4 pl-3 pr-2 border-r border-surface-2 text-right"
                  style={{ minWidth: "2.5rem" }}
                >
                  {code.split("\n").map((_, i) => (
                    <div key={i} className="font-mono text-xs leading-relaxed text-text-muted/30">
                      {i + 1}
                    </div>
                  ))}
                </div>
                {/* Code textarea */}
                <textarea
                  ref={codeTextareaRef}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onScroll={handleCodeScroll}
                  className="flex-1 p-4 bg-surface-0 text-text-primary font-mono text-xs leading-relaxed resize-none focus:outline-none min-w-0"
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col p-4 gap-3 bg-surface-0 min-h-0">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && e.ctrlKey && !generating && handleGenerate()}
                  placeholder={"描述攻略图结构，例如：\n\n游戏有三条主线，在第一章的选择处分叉。A线有两个结局，B线和C线各一个结局。B线还有隐藏结局。"}
                  disabled={generating}
                  className="flex-1 p-3 bg-surface-2 border border-surface-3 rounded-lg text-sm text-text-primary placeholder:text-text-muted/40 leading-relaxed resize-none focus:outline-none focus:border-accent disabled:opacity-50"
                />
                {genError && (
                  <div className="flex items-start gap-1.5 text-[11px] text-red-400 shrink-0">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{genError}</span>
                  </div>
                )}
                <button
                  onClick={handleGenerate}
                  disabled={generating || !prompt.trim()}
                  className="shrink-0 flex items-center justify-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                  {generating ? "生成中…" : "生成"}
                </button>
                <p className="text-[10px] text-text-muted shrink-0">Ctrl+Enter 快捷生成</p>
              </div>
            )}
          </div>

          {/* Right: preview */}
          <div className="flex-1 overflow-auto p-6 min-w-0" style={{ background: MERMAID_THEMES[theme].bg }}>
            {!code.trim() ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-text-muted">
                <GitCommitHorizontal className="w-8 h-8 opacity-20" />
                <p className="text-xs">代码为空，预览将在此显示</p>
              </div>
            ) : (
              <>
                {renderError && (
                  <div className="flex items-start gap-2 p-3 mb-3 bg-surface-2 rounded-lg text-xs border border-red-500/20">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <pre className="text-red-400 whitespace-pre-wrap break-all leading-relaxed">{renderError}</pre>
                  </div>
                )}
                {/* Always mounted so previewRef is never null; hidden when error */}
                <div ref={previewRef} className={renderError ? "hidden" : "flex items-start justify-center min-h-full [&>svg]:max-w-full [&>svg]:h-auto"} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
