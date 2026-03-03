import { useState } from "react";
import {
  X, FolderPlus, Check, Loader2, HardDrive, Globe,
  AlertCircle, CheckCircle2, Trash2, Search, RefreshCw, Star, ChevronRight,
} from "lucide-react";
import type { DetectedGame, GameFormData } from "@/types/game";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  searchVn, getVnById, extractTags, formatVndbDate,
  cleanDescription, pickDisplayTitle, pickOriginalTitle, type VndbVn,
} from "@/lib/vndb";
import { translateDescription, matchGenreTags } from "@/lib/deepseek";
import * as db from "@/lib/database";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/Toast";

// ─── 类型 ────────────────────────────────────────────────────

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

// ─── 辅助函数 ────────────────────────────────────────────────

/**
 * 并行获取封面、截图、翻译简介、匹配标签。
 * 封面/截图走代理，DeepSeek 请求不走代理（由 Rust 端保证）。
 */
async function fetchVnAssets(
  vn: VndbVn,
  apiKey: string,
  proxyUrl: string,
  genreTags: string[],
  toast: (type: "error" | "warning", msg: string) => void,
): Promise<{ coverPath: string; screenshotPaths: string[]; translatedDesc: string; translatedTags: string[] }> {
  const title = pickDisplayTitle(vn);

  // 封面下载
  const coverTask = (async () => {
    if (!vn.image?.url) return "";
    try {
      const ext = vn.image.url.split(".").pop() || "jpg";
      return await invoke<string>("download_cover", {
        url: vn.image.url,
        filename: `${vn.id}.${ext}`,
        proxyUrl,
      });
    } catch (err) {
      toast("error", `「${title}」封面下载失败: ${err}`);
      return "";
    }
  })();

  // 截图下载（过滤 R18 内容，最多 4 张）
  const screenshotsTask = (async () => {
    if (!vn.screenshots?.length) return [];
    const safe = vn.screenshots.filter((s) => s.sexual < 1 && s.violence < 1).slice(0, 4);
    const settled = await Promise.allSettled(
      safe.map((ss) => {
        const ext = ss.url.split(".").pop() || "jpg";
        return invoke<string>("download_screenshot", { url: ss.url, filename: `${ss.id}.${ext}`, proxyUrl });
      })
    );
    return settled
      .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
      .map((r) => r.value);
  })();

  // 简介翻译（无 API Key 则返回原文）
  const descTask = (async () => {
    if (!vn.description) return "";
    const cleaned = cleanDescription(vn.description);
    if (!apiKey) return cleaned;
    try {
      return await translateDescription(cleaned, apiKey);
    } catch (err) {
      toast("warning", `「${title}」简介翻译失败: ${err}`);
      return cleaned;
    }
  })();

  // 标签匹配（将 VNDB 英文标签映射到用户类型标签库）
  const tagsTask = (async () => {
    if (!apiKey) return [];
    const vndbTags = extractTags(vn.tags || []);
    if (!vndbTags.length) return [];
    try {
      return await matchGenreTags(vndbTags, genreTags, apiKey);
    } catch {
      return [];
    }
  })();

  const [coverPath, screenshotPaths, translatedDesc, translatedTags] =
    await Promise.all([coverTask, screenshotsTask, descTask, tagsTask]);

  return { coverPath, screenshotPaths, translatedDesc, translatedTags };
}

// ─── 组件 ────────────────────────────────────────────────────

export function ScanDialog({ onImport, onClose }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<ImportItem[]>([]);
  const [phase, setPhase] = useState<"select" | "matching" | "review" | "importing">("select");
  const [progress, setProgress] = useState({ current: 0, total: 0, label: "" });

  // 审核阶段：当前选中的条目索引及右侧搜索面板状态
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [panelQuery, setPanelQuery] = useState("");
  const [panelSearching, setPanelSearching] = useState(false);
  const [panelResults, setPanelResults] = useState<VndbVn[]>([]);

  // ── 步骤 1：选择文件夹 ───────────────────────────────────

  const handleAddFolders = async () => {
    const result = await open({
      directory: true,
      multiple: true,
      title: "选择游戏文件夹（每个文件夹 = 一个游戏）",
    });
    if (!result) return;

    const paths: string[] = Array.isArray(result) ? result : [result];
    const detected = await invoke<DetectedGame[]>("scan_games", { paths });

    // 去重：跳过当前 session 已有的和数据库中已导入的
    const sessionPaths = new Set(items.map((i) => i.detected.install_path));
    const dbPaths = await db.getExistingInstallPaths();
    let skippedCount = 0;

    const newItems: ImportItem[] = detected
      .filter((g) => {
        if (sessionPaths.has(g.install_path)) return false;
        if (dbPaths.has(g.install_path)) { skippedCount++; return false; }
        return true;
      })
      .map((g) => ({
        detected: g,
        vndb: null, candidates: [],
        coverPath: "", screenshotPaths: [],
        translatedDesc: "", translatedTags: [],
        status: "pending" as const,
      }));

    if (skippedCount > 0) toast("warning", `已跳过 ${skippedCount} 个已导入的游戏`);
    setItems((prev) => [...prev, ...newItems]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    if (activeIdx === index) setActiveIdx(null);
    else if (activeIdx !== null && activeIdx > index) setActiveIdx(activeIdx - 1);
  };

  // ── 步骤 2：自动匹配 VNDB ────────────────────────────────

  const startMatching = async () => {
    if (items.length === 0) return;
    setPhase("matching");

    // 提前读取设置，避免每条游戏重复查数据库
    const [apiKey, proxyUrl, genreTags] = await Promise.all([
      db.getSetting("deepseek_api_key"),
      db.getSetting("proxy_url"),
      db.getGenreTags(),
    ]);

    const total = items.length;
    const CONCURRENCY = 5;   // 最大并发数
    const TIMEOUT_MS = 60_000; // 单条超时 60 秒
    let completedCount = 0;

    setItems((prev) => prev.map((it) => ({ ...it, status: "matching" })));
    setProgress({ current: 0, total, label: "" });

    // 信号量：控制并发数量
    let slots = CONCURRENCY;
    const waiters: (() => void)[] = [];
    const acquire = () => new Promise<void>((resolve) => {
      if (slots > 0) { slots--; resolve(); }
      else waiters.push(resolve);
    });
    const release = () => {
      if (waiters.length > 0) waiters.shift()!();
      else slots++;
    };

    // 单条处理：搜索 VNDB → 下载资源 → 更新状态
    const processItem = async (item: ImportItem, i: number): Promise<void> => {
      try {
        const { results: candidates } = await searchVn(item.detected.title);
        let vn: VndbVn | null = null;
        if (candidates.length > 0) {
          vn = (await getVnById(candidates[0].id)) ?? candidates[0];
        }

        const assets = vn
          ? await fetchVnAssets(vn, apiKey, proxyUrl, genreTags, toast)
          : { coverPath: "", screenshotPaths: [], translatedDesc: "", translatedTags: [] };

        setItems((prev) => prev.map((it, idx) =>
          idx === i ? {
            ...it, vndb: vn, candidates, ...assets,
            status: vn ? "matched" : "failed",
            error: vn ? undefined : "VNDB 未找到匹配",
          } : it
        ));
      } catch (err) {
        setItems((prev) => prev.map((it, idx) =>
          idx === i ? { ...it, status: "failed", error: `匹配失败: ${err}` } : it
        ));
      }
    };

    await Promise.allSettled(
      items.map(async (item, i) => {
        await acquire();

        const work = new Promise<void>((resolve) => {
          processItem(item, i).finally(resolve);
        });

        // 超时保护：60 秒未完成则标记为失败
        let timerId: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<void>((resolve) => {
          timerId = setTimeout(() => {
            toast("error", `「${item.detected.title}」匹配超时（${TIMEOUT_MS / 1000}s）`);
            setItems((prev) => prev.map((it, idx) =>
              idx === i && it.status === "matching"
                ? { ...it, status: "failed", error: "匹配超时" }
                : it
            ));
            resolve();
          }, TIMEOUT_MS);
        });

        await Promise.race([work, timeout]);
        clearTimeout(timerId); // work 先完成时取消超时定时器

        release();
        completedCount++;
        setProgress({ current: completedCount, total, label: item.detected.title });
      })
    );

    setPhase("review");
    setActiveIdx(0);
  };

  // ── 审核：手动更换匹配条目 ───────────────────────────────

  const openPanel = (index: number) => {
    setActiveIdx(index);
    setPanelQuery(items[index].detected.title);
    setPanelResults(items[index].candidates);
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
    const targetIdx = activeIdx; // 快照，防止异步期间 activeIdx 变化

    // 立即显示选中效果，UI 无延迟感
    setItems((prev) => prev.map((it, idx) =>
      idx === targetIdx ? { ...it, vndb: vn, status: "matching", error: undefined } : it
    ));

    try {
      const fullVn = (await getVnById(vn.id)) ?? vn;
      setItems((prev) => prev.map((it, idx) =>
        idx === targetIdx ? { ...it, vndb: fullVn } : it
      ));

      const [apiKey, proxyUrl, genreTags] = await Promise.all([
        db.getSetting("deepseek_api_key"),
        db.getSetting("proxy_url"),
        db.getGenreTags(),
      ]);

      const assets = await fetchVnAssets(fullVn, apiKey, proxyUrl, genreTags, toast);

      setItems((prev) => prev.map((it, idx) =>
        idx === targetIdx
          ? { ...it, vndb: fullVn, ...assets, status: "matched", error: undefined }
          : it
      ));
    } catch (err) {
      setItems((prev) => prev.map((it, idx) =>
        idx === targetIdx ? { ...it, status: "failed", error: `处理失败: ${err}` } : it
      ));
    }
  };

  const clearMatch = () => {
    if (activeIdx === null) return;
    setItems((prev) => prev.map((it, idx) =>
      idx === activeIdx
        ? { ...it, vndb: null, coverPath: "", status: "failed", error: "手动跳过" }
        : it
    ));
  };

  // ── 步骤 3：导入 ─────────────────────────────────────────

  const handleImport = async () => {
    setPhase("importing");
    const toImport: GameFormData[] = items.map((item) => {
      const vn = item.vndb;
      return {
        title:          vn ? pickDisplayTitle(vn) : item.detected.title,
        title_original: vn ? pickOriginalTitle(vn) : "",
        vndb_id:        vn?.id || "",
        developer:      vn?.developers?.map((d) => d.name).join(", ") || "",
        release_date:   vn ? formatVndbDate(vn.released) : "",
        exe_path:       item.detected.exe_path,
        install_path:   item.detected.install_path,
        save_path:      "",
        cover_path:     item.coverPath,
        screenshots:    item.screenshotPaths,
        tags:           item.translatedTags,
        play_status:    "unplayed" as const,
        rating:         0,
        vndb_rating:    vn?.rating || 0,
        vndb_votecount: vn?.votecount || 0,
        length_minutes: vn?.length_minutes || 0,
        notes:          item.translatedDesc || (vn?.description ? cleanDescription(vn.description) : ""),
        engine:         item.detected.engine || "",
      };
    });
    await onImport(toImport);
  };

  // ── 计算状态 ─────────────────────────────────────────────

  const matchedCount = items.filter((i) => i.status === "matched").length;
  const failedCount  = items.filter((i) => i.status === "failed").length;
  const isAnyMatching = items.some((i) => i.status === "matching");
  const activeItem = activeIdx !== null ? items[activeIdx] : null;
  const isReview = phase === "review";

  // ── 渲染 ─────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 dialog-overlay backdrop-blur-sm" onClick={onClose} />

      <div className={cn(
        "relative bg-surface-1 border border-surface-3 rounded-2xl overflow-hidden flex flex-col shadow-2xl transition-all",
        isReview ? "w-full max-w-4xl max-h-[88vh]" : "w-full max-w-2xl max-h-[85vh]"
      )}>
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-3">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-accent" />
            导入游戏
            {isReview && <span className="text-xs font-normal text-text-muted ml-2">— 确认匹配结果</span>}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-surface-3 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-text-secondary" />
          </button>
        </div>

        {/* 匹配进度条 */}
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

        {/* 主体 */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {/* 左侧：条目列表 */}
          <div className={cn("overflow-y-auto py-4", isReview ? "w-1/2 px-4 border-r border-surface-3" : "flex-1 px-6")}>

            {/* 空状态 */}
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
                {/* 汇总（仅审核阶段显示） */}
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
                        : item.status === "matched"  ? "bg-status-finished/5 border-status-finished/20"
                        : item.status === "failed"   ? "bg-status-playing/5 border-status-playing/20"
                        : item.status === "matching" ? "bg-accent/5 border-accent/20"
                        : "bg-surface-2 border-surface-3",
                      isReview && activeIdx !== i && "hover:bg-surface-3/50"
                    )}
                  >
                    {/* 封面缩略图 */}
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
                      {item.status === "matched"  && <CheckCircle2 className="w-4 h-4 text-status-finished" />}
                      {item.status === "failed"   && <AlertCircle className="w-4 h-4 text-status-playing" />}
                      {isReview && <ChevronRight className="w-3.5 h-3.5 text-text-muted/40" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 右侧：审核面板（仅审核阶段显示） */}
          {isReview && (
            <div className="w-1/2 overflow-y-auto">
              {activeItem ? (
                <div className="p-4 space-y-4">
                  {/* 路径信息 */}
                  <div className="p-3 bg-surface-2 rounded-lg text-xs space-y-2">
                    <div>
                      <p className="text-text-muted mb-0.5">文件夹</p>
                      <p className="text-text-secondary truncate">{activeItem.detected.install_path}</p>
                    </div>
                    <div>
                      <p className="text-text-muted mb-0.5">选中的 EXE</p>
                      <p className="text-text-secondary truncate">{activeItem.detected.exe_path}</p>
                    </div>
                    {activeItem.detected.engine && (
                      <div>
                        <p className="text-text-muted mb-0.5">引擎</p>
                        <p className="text-text-secondary">{activeItem.detected.engine}</p>
                      </div>
                    )}
                  </div>

                  {/* 当前匹配结果 */}
                  {activeItem.vndb ? (
                    <div className="p-3 bg-status-finished/5 border border-status-finished/20 rounded-lg">
                      <div className="flex items-start gap-3">
                        {activeItem.vndb.image?.url && (
                          <img src={activeItem.vndb.image.url} alt="" className="w-14 h-20 object-cover rounded flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-text-primary">{pickDisplayTitle(activeItem.vndb)}</p>
                          {pickOriginalTitle(activeItem.vndb) && (
                            <p className="text-[10px] text-text-muted truncate">{pickOriginalTitle(activeItem.vndb)}</p>
                          )}
                          <p className="text-[10px] text-text-muted mt-1">
                            {activeItem.vndb.id}
                            {activeItem.vndb.released && ` · ${activeItem.vndb.released}`}
                            {activeItem.vndb.rating && ` · ★${(activeItem.vndb.rating / 10).toFixed(2)}`}
                          </p>
                          {activeItem.vndb.developers?.length > 0 && (
                            <p className="text-[10px] text-text-muted">
                              {activeItem.vndb.developers.map((d) => d.name).join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                      <button onClick={clearMatch} className="mt-2 text-[10px] text-status-shelved hover:underline">
                        取消匹配（仅导入文件夹信息）
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 bg-status-playing/5 border border-status-playing/20 rounded-lg text-xs text-status-playing">
                      未匹配到 VNDB 条目，请尝试手动搜索
                    </div>
                  )}

                  {/* 手动搜索 */}
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

                  {/* 候选结果列表 */}
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
                            {vn.image?.url
                              ? <img src={vn.image.url} alt="" className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center text-[8px] text-text-muted">{vn.id}</div>
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-text-primary truncate">{pickDisplayTitle(vn)}</p>
                            {vn.alttitle && <p className="text-[10px] text-text-muted truncate">{vn.alttitle}</p>}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[9px] text-text-muted">{vn.id}</span>
                              {vn.released && vn.released !== "TBA" && (
                                <span className="text-[9px] text-text-muted">{vn.released}</span>
                              )}
                              {vn.rating && (
                                <span className="text-[9px] text-accent flex items-center gap-0.5">
                                  <Star className="w-2 h-2" fill="currentColor" />
                                  {(vn.rating / 10).toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                          {activeItem.vndb?.id === vn.id && <Check className="w-3.5 h-3.5 text-accent flex-shrink-0" />}
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

        {/* 底部操作栏 */}
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
              <p className="text-xs text-text-muted">未匹配的游戏仍将导入，可稍后手动匹配</p>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
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
                disabled={isAnyMatching}
                className={cn(
                  "flex items-center gap-2 px-5 py-2 text-white text-sm font-medium rounded-lg transition-colors",
                  isAnyMatching ? "bg-accent/50 cursor-not-allowed" : "bg-accent hover:bg-accent-hover"
                )}
              >
                {isAnyMatching
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> 加载中...</>
                  : <><Check className="w-4 h-4" /> 确认导入 ({items.length})</>
                }
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
