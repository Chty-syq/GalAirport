import { useState } from "react";
import {
  X,
  FolderPlus,
  Check,
  Loader2,
  HardDrive,
  Globe,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Search,
  RefreshCw,
  Star,
  ChevronRight,
} from "lucide-react";
import type { DetectedGame, GameFormData } from "@/types/game";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  searchVn,
  getVnById,
  extractTags,
  formatVndbDate,
  cleanDescription,
  pickDisplayTitle,
  pickOriginalTitle,
  type VndbVn,
} from "@/lib/vndb";
import { translateDescription, translateTags } from "@/lib/deepseek";
import * as db from "@/lib/database";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/Toast";

interface ImportItem {
  detected: DetectedGame;
  vndb: VndbVn | null;
  candidates: VndbVn[];
  coverPath: string;
  screenshotPaths: string[];
  translatedDesc: string;
  translatedTags: string[];
  status: "pending" | "matching" | "matched" | "failed" | "importing" | "done";
  error?: string;
}

interface Props {
  onImport: (games: GameFormData[]) => Promise<void>;
  onClose: () => void;
}

export function ScanDialog({ onImport, onClose }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<ImportItem[]>([]);
  const [phase, setPhase] = useState<"select" | "matching" | "review" | "importing">("select");
  const [progress, setProgress] = useState({ current: 0, total: 0, label: "" });

  // Review-phase: which item is being inspected
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [panelQuery, setPanelQuery] = useState("");
  const [panelSearching, setPanelSearching] = useState(false);
  const [panelResults, setPanelResults] = useState<VndbVn[]>([]);

  // ── Step 1: Select folders ──────────────────────────────────

  const handleAddFolders = async () => {
    const result = await open({
      directory: true,
      multiple: true,
      title: "选择游戏文件夹（每个文件夹 = 一个游戏）",
    });
    if (!result) return;

    const paths: string[] = Array.isArray(result) ? result : [result];
    const detected = await invoke<DetectedGame[]>("scan_games", { paths });

    const existingPaths = new Set(items.map((i) => i.detected.install_path));
    const newItems: ImportItem[] = detected
      .filter((g) => !existingPaths.has(g.install_path))
      .map((g) => ({
        detected: g,
        vndb: null,
        candidates: [],
        coverPath: "",
        screenshotPaths: [],
        translatedDesc: "",
        translatedTags: [],
        status: "pending" as const,
      }));

    setItems((prev) => [...prev, ...newItems]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    if (activeIdx === index) setActiveIdx(null);
    else if (activeIdx !== null && activeIdx > index) setActiveIdx(activeIdx - 1);
  };

  // ── Step 2: Auto match VNDB ─────────────────────────────────

  const startMatching = async () => {
    if (items.length === 0) return;
    setPhase("matching");
    console.log("matching");

    // Pre-fetch API key once (avoid repeated DB reads)
    const apiKey = await db.getSetting("deepseek_api_key");

    const total = items.length;
    for (let i = 0; i < total; i++) {
      const item = items[i];
      setProgress({ current: i + 1, total, label: item.detected.title });

      setItems((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, status: "matching" } : it))
      );

      try {
        const res = await searchVn(item.detected.title);
        let vn: VndbVn | null = null;
        const candidates = res.results;

        if (candidates.length > 0) {
          vn = await getVnById(candidates[0].id);
          if (!vn) vn = candidates[0];
        }

        // Run cover download, screenshot downloads, translation, and tag translation in PARALLEL
        console.log("downing");
        const coverPromise = (async () => {
          if (vn?.image?.url) {
            try {
              const ext = vn.image.url.split(".").pop() || "jpg";
              return await invoke<string>("download_cover", {
                url: vn.image.url,
                filename: `${vn.id}.${ext}`,
              });
            } catch (err) {
              toast("error", `「${pickDisplayTitle(vn!)}」封面下载失败: ${err}`);
            }
          }
          return "";
        })();

        const screenshotsPromise = (async () => {
          if (!vn?.screenshots?.length) return [];
          const safe = vn.screenshots.filter((s) => s.sexual < 1 && s.violence < 1).slice(0, 4);
          // Download all screenshots in parallel
          const results = await Promise.allSettled(
            safe.map((ss) => {
              const ext = ss.url.split(".").pop() || "jpg";
              return invoke<string>("download_screenshot", { url: ss.url, filename: `${ss.id}.${ext}` });
            })
          );
          return results
            .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
            .map((r) => r.value);
        })();

        const descPromise = (async () => {
          if (!vn?.description) return "";
          if (apiKey) {
            try {
              return await translateDescription(vn.description, apiKey);
            } catch (err) {
              toast("warning", `「${pickDisplayTitle(vn!)}」简介翻译失败: ${err}`);
              return cleanDescription(vn.description);
            }
          }
          return cleanDescription(vn.description);
        })();

        const tagsPromise = (async () => {
          if (!vn) return [];
          const vndbTags = extractTags(vn.tags || []);
          if (apiKey && vndbTags.length > 0) {
            try {
              return await translateTags(vndbTags, apiKey);
            } catch {
              return vndbTags;
            }
          }
          return vndbTags;
        })();

        // Await all in parallel
        const [coverPath, screenshotPaths, translatedDesc, translatedTags] = await Promise.all([
          coverPromise,
          screenshotsPromise,
          descPromise,
          tagsPromise,
        ]);

        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? {
                  ...it,
                  vndb: vn,
                  candidates,
                  coverPath,
                  screenshotPaths,
                  translatedDesc,
                  translatedTags,
                  status: vn ? "matched" : "failed",
                  error: vn ? undefined : "VNDB 未找到匹配",
                }
              : it
          )
        );
      } catch (err) {
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i ? { ...it, status: "failed", error: `匹配失败: ${err}` } : it
          )
        );
      }

      if (i < total - 1) await new Promise((r) => setTimeout(r, 500));
    }

    setPhase("review");
    setActiveIdx(0);
  };

  // ── Review: select different candidate ──────────────────────
  console.log("reviewing");
  const openPanel = (index: number) => {
    setActiveIdx(index);
    const item = items[index];
    setPanelQuery(item.detected.title);
    setPanelResults(item.candidates);
  };

  const panelSearch = async () => {
    if (!panelQuery.trim()) return;
    setPanelSearching(true);
    try {
      const res = await searchVn(panelQuery.trim());
      setPanelResults(res.results);
    } catch {
      setPanelResults([]);
    } finally {
      setPanelSearching(false);
    }
  };

  const pickCandidate = async (vn: VndbVn) => {
    if (activeIdx === null) return;

    let fullVn = await getVnById(vn.id);
    if (!fullVn) fullVn = vn;

    const apiKey = await db.getSetting("deepseek_api_key");

    // Run all processing in parallel
    const coverPromise = (async () => {
      if (fullVn!.image?.url) {
        try {
          const ext = fullVn!.image.url.split(".").pop() || "jpg";
          return await invoke<string>("download_cover", {
            url: fullVn!.image.url,
            filename: `${fullVn!.id}.${ext}`,
          });
        } catch (err) {
          toast("error", `「${pickDisplayTitle(fullVn!)}」封面下载失败: ${err}`);
        }
      }
      return "";
    })();

    const screenshotsPromise = (async () => {
      if (!fullVn!.screenshots?.length) return [];
      const safe = fullVn!.screenshots.filter((s) => s.sexual < 1 && s.violence < 1).slice(0, 4);
      const results = await Promise.allSettled(
        safe.map((ss) => {
          const ext = ss.url.split(".").pop() || "jpg";
          return invoke<string>("download_screenshot", { url: ss.url, filename: `${ss.id}.${ext}` });
        })
      );
      return results
        .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
        .map((r) => r.value);
    })();

    const descPromise = (async () => {
      if (!fullVn!.description) return "";
      if (apiKey) {
        try {
          return await translateDescription(fullVn!.description, apiKey);
        } catch (err) {
          toast("warning", `「${pickDisplayTitle(fullVn!)}」简介翻译失败: ${err}`);
          return cleanDescription(fullVn!.description);
        }
      }
      return cleanDescription(fullVn!.description);
    })();

    const tagsPromise = (async () => {
      const vndbTags = extractTags(fullVn!.tags || []);
      if (apiKey && vndbTags.length > 0) {
        try {
          return await translateTags(vndbTags, apiKey);
        } catch {
          return vndbTags;
        }
      }
      return vndbTags;
    })();

    const [coverPath, screenshotPaths, translatedDesc, translatedTags] = await Promise.all([
      coverPromise,
      screenshotsPromise,
      descPromise,
      tagsPromise,
    ]);

    setItems((prev) =>
      prev.map((it, idx) =>
        idx === activeIdx
          ? { ...it, vndb: fullVn, coverPath, screenshotPaths, translatedDesc, translatedTags, status: "matched", error: undefined }
          : it
      )
    );
  };

  const clearMatch = () => {
    if (activeIdx === null) return;
    setItems((prev) =>
      prev.map((it, idx) =>
        idx === activeIdx
          ? { ...it, vndb: null, coverPath: "", status: "failed", error: "手动跳过" }
          : it
      )
    );
  };

  // ── Step 3: Import ──────────────────────────────────────────

  const handleImport = async () => {
    setPhase("importing");
    console.log("importing");
    const toImport: GameFormData[] = items.map((item) => {
      const vn = item.vndb;
      const developer =
        vn?.developers && vn.developers.length > 0
          ? vn.developers.map((d) => d.name).join(", ")
          : "";

      // Use translated tags if available, otherwise English originals
      const vndbTags = vn ? extractTags(vn.tags || []) : [];
      const allTags = item.translatedTags.length > 0 ? item.translatedTags : vndbTags;

      return {
        title: vn ? pickDisplayTitle(vn) : item.detected.title,
        title_original: vn ? pickOriginalTitle(vn) : "",
        vndb_id: vn?.id || "",
        developer,
        release_date: vn ? formatVndbDate(vn.released) : "",
        exe_path: item.detected.exe_path,
        install_path: item.detected.install_path,
        save_path: "",
        cover_path: item.coverPath,
        screenshots: item.screenshotPaths,
        tags: allTags,
        play_status: "unplayed" as const,
        rating: 0,
        vndb_rating: vn?.rating || 0,
        notes: item.translatedDesc || (vn?.description ? cleanDescription(vn.description) : ""),
        engine: item.detected.engine || "",
      };
    });
    await onImport(toImport);
  };

  // ── Helpers ─────────────────────────────────────────────────

  const matchedCount = items.filter((i) => i.status === "matched").length;
  const failedCount = items.filter((i) => i.status === "failed").length;
  const activeItem = activeIdx !== null ? items[activeIdx] : null;
  const isReview = phase === "review";

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 dialog-overlay backdrop-blur-sm" onClick={onClose} />

      <div
        className={cn(
          "relative bg-surface-1 border border-surface-3 rounded-2xl overflow-hidden flex flex-col shadow-2xl transition-all",
          isReview ? "w-full max-w-4xl max-h-[88vh]" : "w-full max-w-2xl max-h-[85vh]"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-3">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-accent" />
            导入游戏
            {isReview && (
              <span className="text-xs font-normal text-text-muted ml-2">— 确认匹配结果</span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-surface-3 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-text-secondary" />
          </button>
        </div>

        {/* Progress bar */}
        {phase === "matching" && (
          <div className="px-6 py-3 border-b border-surface-3">
            <div className="flex items-center justify-between text-xs text-text-secondary mb-1.5">
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-accent animate-pulse" />
                正在匹配 VNDB 元数据...
              </span>
              <span>{progress.current} / {progress.total}</span>
            </div>
            <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
            <p className="text-xs text-text-muted mt-1 truncate">{progress.label}</p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {/* Left: item list */}
          <div className={cn("overflow-y-auto px-4 py-4", isReview ? "w-1/2 border-r border-surface-3" : "flex-1 px-6")}>
            {/* Empty */}
            {items.length === 0 && phase === "select" && (
              <div className="flex flex-col items-center justify-center py-16 text-text-muted">
                <FolderPlus className="w-14 h-14 mb-3 opacity-20" />
                <p className="text-sm font-medium mb-1">选择游戏文件夹</p>
                <p className="text-xs text-center max-w-xs">
                  每个文件夹代表一个游戏，导入时将自动从 VNDB 匹配元数据和封面。
                </p>
              </div>
            )}

            {items.length > 0 && (
              <div className="space-y-1.5">
                {/* Summary */}
                {isReview && (
                  <div className="flex items-center gap-3 mb-2 text-xs px-1">
                    <span className="text-text-secondary">共 {items.length} 个</span>
                    {matchedCount > 0 && (
                      <span className="text-status-finished flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {matchedCount} 匹配
                      </span>
                    )}
                    {failedCount > 0 && (
                      <span className="text-status-playing flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {failedCount} 未匹配
                      </span>
                    )}
                  </div>
                )}

                {items.map((item, i) => (
                  <div
                    key={item.detected.install_path}
                    onClick={() => isReview && openPanel(i)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors",
                      isReview && "cursor-pointer",
                      activeIdx === i && isReview
                        ? "bg-accent/10 border-accent/30 ring-1 ring-accent/20"
                        : item.status === "matched"
                          ? "bg-status-finished/5 border-status-finished/20"
                          : item.status === "failed"
                            ? "bg-status-playing/5 border-status-playing/20"
                            : item.status === "matching"
                              ? "bg-accent/5 border-accent/20"
                              : "bg-surface-2 border-surface-3",
                      isReview && activeIdx !== i && "hover:bg-surface-3/50"
                    )}
                  >
                    {/* Thumbnail */}
                    <div className="w-9 h-12 rounded overflow-hidden bg-surface-3 flex-shrink-0">
                      {item.vndb?.image?.url ? (
                        <img src={item.vndb.image.url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-text-muted font-bold">
                          {item.detected.title.charAt(0)}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {item.vndb ? pickDisplayTitle(item.vndb) : item.detected.title}
                      </p>
                      <p className="text-[10px] text-text-muted truncate mt-0.5">
                        {item.vndb
                          ? `${item.vndb.id} · ${item.vndb.developers?.map((d) => d.name).join(", ") || ""}`
                          : item.detected.install_path}
                      </p>
                    </div>

                    {/* Status / actions */}
                    <div className="flex-shrink-0 flex items-center gap-1">
                      {item.detected.engine && !isReview && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-surface-3 rounded-full text-text-muted">
                          {item.detected.engine}
                        </span>
                      )}
                      {item.status === "pending" && phase === "select" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); removeItem(i); }}
                          className="w-6 h-6 rounded-full hover:bg-surface-4 flex items-center justify-center"
                        >
                          <Trash2 className="w-3 h-3 text-text-muted" />
                        </button>
                      )}
                      {item.status === "matching" && <Loader2 className="w-4 h-4 text-accent animate-spin" />}
                      {item.status === "matched" && <CheckCircle2 className="w-4 h-4 text-status-finished" />}
                      {item.status === "failed" && <AlertCircle className="w-4 h-4 text-status-playing" />}
                      {isReview && <ChevronRight className="w-3.5 h-3.5 text-text-muted/40" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: match detail / candidate picker (review phase only) */}
          {isReview && (
            <div className="w-1/2 overflow-y-auto">
              {activeItem ? (
                <div className="p-4 space-y-4">
                  {/* Current match info */}
                  <div className="p-3 bg-surface-2 rounded-lg">
                    <p className="text-[10px] text-text-muted mb-1">文件夹</p>
                    <p className="text-xs text-text-secondary truncate">{activeItem.detected.install_path}</p>
                    <p className="text-[10px] text-text-muted mt-2 mb-1">选中的 EXE</p>
                    <p className="text-xs text-text-secondary truncate">{activeItem.detected.exe_path}</p>
                    {activeItem.detected.engine && (
                      <>
                        <p className="text-[10px] text-text-muted mt-2 mb-1">引擎</p>
                        <p className="text-xs text-text-secondary">{activeItem.detected.engine}</p>
                      </>
                    )}
                  </div>

                  {/* Current VNDB match */}
                  {activeItem.vndb && (
                    <div className="p-3 bg-status-finished/5 border border-status-finished/20 rounded-lg">
                      <div className="flex items-start gap-3">
                        {activeItem.vndb.image?.url && (
                          <img
                            src={activeItem.vndb.image.url}
                            alt=""
                            className="w-14 h-20 object-cover rounded flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-text-primary">
                            {pickDisplayTitle(activeItem.vndb)}
                          </p>
                          {pickOriginalTitle(activeItem.vndb) && (
                            <p className="text-[10px] text-text-muted truncate">
                              {pickOriginalTitle(activeItem.vndb)}
                            </p>
                          )}
                          <p className="text-[10px] text-text-muted mt-1">
                            {activeItem.vndb.id}
                            {activeItem.vndb.released && ` · ${activeItem.vndb.released}`}
                            {activeItem.vndb.rating && ` · ★${(activeItem.vndb.rating / 10).toFixed(1)}`}
                          </p>
                          {activeItem.vndb.developers?.length > 0 && (
                            <p className="text-[10px] text-text-muted">
                              {activeItem.vndb.developers.map((d) => d.name).join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={clearMatch}
                        className="mt-2 text-[10px] text-status-shelved hover:underline"
                      >
                        取消匹配（仅导入文件夹信息）
                      </button>
                    </div>
                  )}

                  {!activeItem.vndb && (
                    <div className="p-3 bg-status-playing/5 border border-status-playing/20 rounded-lg text-xs text-status-playing">
                      未匹配到 VNDB 条目，请尝试手动搜索
                    </div>
                  )}

                  {/* Manual search */}
                  <div>
                    <p className="text-[10px] text-text-muted mb-1.5">
                      {activeItem.vndb ? "更换匹配" : "手动搜索"}
                    </p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                        <input
                          type="text"
                          value={panelQuery}
                          onChange={(e) => setPanelQuery(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && panelSearch()}
                          placeholder="输入标题搜索..."
                          className="w-full pl-8 pr-3 py-1.5 bg-surface-2 border border-surface-3 rounded-lg text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent"
                        />
                      </div>
                      <button
                        onClick={panelSearch}
                        disabled={panelSearching}
                        className="px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-xs rounded-lg"
                      >
                        {panelSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : "搜索"}
                      </button>
                    </div>
                  </div>

                  {/* Candidate list */}
                  {panelResults.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-text-muted">候选结果（点击选择）</p>
                      {panelResults.map((vn) => (
                        <button
                          key={vn.id}
                          onClick={() => pickCandidate(vn)}
                          className={cn(
                            "w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors border",
                            activeItem.vndb?.id === vn.id
                              ? "bg-accent/10 border-accent/30"
                              : "bg-surface-2 border-surface-3 hover:bg-surface-3"
                          )}
                        >
                          <div className="w-8 h-11 rounded overflow-hidden bg-surface-3 flex-shrink-0">
                            {vn.image?.url ? (
                              <img src={vn.image.url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[8px] text-text-muted">
                                {vn.id}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-text-primary truncate">
                              {pickDisplayTitle(vn)}
                            </p>
                            {vn.alttitle && (
                              <p className="text-[10px] text-text-muted truncate">{vn.alttitle}</p>
                            )}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[9px] text-text-muted">{vn.id}</span>
                              {vn.released && vn.released !== "TBA" && (
                                <span className="text-[9px] text-text-muted">{vn.released}</span>
                              )}
                              {vn.rating && (
                                <span className="text-[9px] text-accent flex items-center gap-0.5">
                                  <Star className="w-2 h-2" fill="currentColor" />
                                  {(vn.rating / 10).toFixed(1)}
                                </span>
                              )}
                            </div>
                          </div>
                          {activeItem.vndb?.id === vn.id && (
                            <Check className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-text-muted">
                  <Globe className="w-10 h-10 mb-2 opacity-20" />
                  <p className="text-xs">点击左侧游戏查看匹配详情</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-surface-3">
          <div>
            {phase === "select" && (
              <button
                onClick={handleAddFolders}
                className="flex items-center gap-1.5 px-4 py-2 bg-surface-3 hover:bg-surface-4 text-text-secondary text-sm rounded-lg transition-colors"
              >
                <FolderPlus className="w-4 h-4" />
                选择文件夹
              </button>
            )}
            {isReview && failedCount > 0 && (
              <p className="text-xs text-text-muted">
                未匹配的游戏仍将导入，可稍后手动匹配
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              取消
            </button>

            {phase === "select" && items.length > 0 && (
              <button
                onClick={startMatching}
                className="flex items-center gap-2 px-5 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Globe className="w-4 h-4" />
                开始匹配 ({items.length})
              </button>
            )}

            {isReview && (
              <button
                onClick={handleImport}
                className="flex items-center gap-2 px-5 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Check className="w-4 h-4" />
                确认导入 ({items.length})
              </button>
            )}

            {phase === "importing" && (
              <button disabled className="flex items-center gap-2 px-5 py-2 bg-accent/50 text-white text-sm font-medium rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin" />
                正在导入...
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}