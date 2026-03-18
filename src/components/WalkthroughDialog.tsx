import { useState, useEffect, useRef } from "react";
import mermaid from "mermaid";
import { X, Edit, Wand2, Loader2, Save, AlertCircle, GitBranch, ArrowLeft, GitCommitHorizontal } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { Game } from "@/types/game";
import * as db from "@/lib/database";

// ─── Unified flowchart style (theme-independent) ─────────────
// Node semantics (Mermaid shape → SVG element):
//   ([text])   stadium  → <path>    : steel blue — main narrative / story nodes
//   [text]     rect     → <rect>    : deep rose  — player choices / branch nodes
//   {{text}}   hexagon  → <polygon> : forest green, left-right pointed — decision nodes ◁▬▷
//   ((text))   circle   → <circle>  : warm purple — route endings
const FLOWCHART_BG = "linear-gradient(160deg, #f5f0fc 0%, #ede8f8 55%, #f8f4ff 100%)";

const FLOWCHART_VARS: Record<string, string> = {
  primaryColor: "#2e6a98",
  primaryTextColor: "#ffffff",
  primaryBorderColor: "#4d90c8",
  secondaryColor: "#c8304a",
  secondaryTextColor: "#ffffff",
  secondaryBorderColor: "#e85570",
  tertiaryColor: "#257a50",
  tertiaryTextColor: "#ffffff",
  tertiaryBorderColor: "#3aaa72",
  lineColor: "#1a1a1a",
  edgeLabelBackground: "#ede8f8",
  background: "#f5f0fc",
  mainBkg: "#2e6a98",
  nodeBorder: "#4d90c8",
  clusterBkg: "#ede8f8",
  clusterBorder: "#c8b8e0",
  noteBkgColor: "#ede8f8",
  noteTextColor: "#5a3a7a",
  noteBorderColor: "#c8b8e0",
  titleColor: "#2a1a4a",
  textColor: "#2a1a4a",
  fontSize: "24px",
};

const FLOWCHART_SVG_CSS = `
  /* Stadium ([text]) — steel blue, main narrative */
  g.node > path    { fill:#2e6a98!important; stroke:#4d90c8!important; stroke-width:2px!important; filter:drop-shadow(0 3px 8px rgba(46,106,152,.22)); }
  /* Rect [text] — cherry pink, player choices */
  g.node > rect    { fill:#cc3a62!important; stroke:#e8608a!important; stroke-width:2px!important; rx:8px!important; ry:8px!important; filter:drop-shadow(0 3px 8px rgba(204,58,98,.24)); }
  /* Hexagon {{text}} — forest green, decision nodes with pointed left/right ends */
  g.node > polygon { fill:#257a50!important; stroke:#3aaa72!important; stroke-width:2px!important; filter:drop-shadow(0 3px 8px rgba(37,122,80,.22)); }
  /* Circle ((text)) — warm purple, route endings */
  g.node > circle  { fill:#6a3898!important; stroke:#9060c8!important; stroke-width:2px!important; filter:drop-shadow(0 3px 8px rgba(106,56,152,.22)); }
  /* All node labels: white text */
  g.node text, g.node .label { fill:#ffffff!important; color:#ffffff!important; }
  /* Arrows: black, bold — multiple selectors for Mermaid v10/v11 compatibility */
  .edgePath path, .edgePath path.path,
  path.flowchart-link, .edge path,
  g.edgePaths path, g.edges path { stroke:#1a1a1a!important; stroke-width:6px!important; stroke-linecap:round!important; stroke-linejoin:round!important; }
  .edgePath marker path, marker path { fill:#1a1a1a!important; stroke:#1a1a1a!important; }
  /* Edge label */
  .edgeLabel .label rect { fill:#ede8f8!important; stroke:#c8b8e0!important; }
  .edgeLabel .label span, .edgeLabel .label p { color:#5a3a7a!important; }
`;

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
    const timer = setTimeout(async () => {
      if (cancelled || !container) return;
      mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        themeVariables: FLOWCHART_VARS,
        fontFamily: "system-ui, -apple-system, sans-serif",
        flowchart: { curve: "basis", padding: 20, diagramPadding: 24 },
      });
      try {
        const { svg } = await mermaid.render(`mm-${id}`, code);
        if (!cancelled && previewRef.current === container) {
          // Enlarge arrowhead markers directly in the SVG string before DOM parsing
          const processedSvg = svg
            .replace(/markerWidth="[^"]*"/g, 'markerWidth="16"')
            .replace(/markerHeight="[^"]*"/g, 'markerHeight="16"')
            .replace(/(<marker[^>]*>[\s\S]*?<path[^>]*)\bfill="[^"]*"/g, '$1fill="#1a1a1a"');
          container.innerHTML = enhanceSvg(processedSvg, FLOWCHART_SVG_CSS);
          // Force edge stroke-width via DOM (overrides Mermaid inline styles)
          container.querySelectorAll<SVGPathElement>(
            ".edgePath path, path.flowchart-link, g.edges path, g.edgePaths path"
          ).forEach((p) => {
            p.style.setProperty("stroke", "#1a1a1a", "important");
            p.style.setProperty("stroke-width", "6px", "important");
            p.style.setProperty("stroke-linecap", "round", "important");
          });
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
  }, [code, mode]);

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
          <div className="flex-1 overflow-auto p-6 min-h-0" style={{ background: FLOWCHART_BG }}>
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
          <div className="flex-1 overflow-auto p-6 min-w-0" style={{ background: FLOWCHART_BG }}>
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
