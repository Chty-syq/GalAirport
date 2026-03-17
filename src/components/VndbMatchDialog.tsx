import { useState, useEffect } from "react";
import {
  X,
  Search,
  Loader2,
  Globe,
  Star,
  Clock,
  Check,
  Download,
  Tag,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { Game, GameFormData } from "@/types/game";
import {
  searchVn,
  getVnById,
  fetchVnCovers,
  extractTags,
  formatVndbDate,
  cleanDescription,
  pickDisplayTitle,
  pickOriginalTitle,
  type VndbVn,
  type VndbImage,
} from "@/lib/vndb";
import { translateDescription, matchGenreTags } from "@/lib/deepseek";
import * as database from "@/lib/database";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/Toast";

interface Props {
  game: Game;
  onApply: (data: Partial<GameFormData>) => void;
  onClose: () => void;
}

export function VndbMatchDialog({ game, onClose, onApply }: Props) {
  const { toast } = useToast();
  const [query, setQuery] = useState(game.title);
  const [results, setResults] = useState<VndbVn[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedVn, setSelectedVn] = useState<VndbVn | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cover selection
  const [allCovers, setAllCovers] = useState<VndbImage[]>([]);
  const [selectedCoverId, setSelectedCoverId] = useState<string | null>(null);

  // Screenshot lightbox
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // Auto-search on mount
  useEffect(() => {
    if (query.trim()) doSearch();
  }, []);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIdx === null || !selectedVn) return;
    const screenshots = selectedVn.screenshots ?? [];
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setLightboxIdx((i) => (i !== null ? Math.max(0, i - 1) : null));
      else if (e.key === "ArrowRight") setLightboxIdx((i) => (i !== null ? Math.min(screenshots.length - 1, i + 1) : null));
      else if (e.key === "Escape") setLightboxIdx(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxIdx, selectedVn]);

  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    setSelectedVn(null);
    setAllCovers([]);
    setSelectedCoverId(null);
    try {
      const res = await searchVn(query.trim());
      setResults(res.results);
      if (res.results.length === 0) {
        setError("未找到匹配结果，请尝试日文/英文标题");
      }
    } catch (err) {
      setError(`搜索失败: ${err}`);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const selectVn = async (vn: VndbVn) => {
    setSelectedVn(vn);
    // Immediately show the main image — don't wait for async
    const initialCovers: VndbImage[] = vn.image ? [vn.image] : [];
    setAllCovers(initialCovers);
    setSelectedCoverId(vn.image?.id ?? null);
    setLoadingDetail(true);
    try {
      const [detail, covers] = await Promise.all([
        getVnById(vn.id),
        fetchVnCovers(vn.id),
      ]);
      if (detail) setSelectedVn(detail);
      // Merge main image + release covers, deduplicate
      const mainImg = detail?.image ?? vn.image;
      const seen = new Set<string>();
      const merged: VndbImage[] = [];
      if (mainImg) { seen.add(mainImg.id); merged.push(mainImg); }
      for (const c of covers) {
        if (!seen.has(c.id)) { seen.add(c.id); merged.push(c); }
      }
      setAllCovers(merged);
      // Keep current selection if it's still in the merged list; else reset to main
      setSelectedCoverId((prev) =>
        merged.find((c) => c.id === prev) ? prev : (mainImg?.id ?? null)
      );
    } catch {
      // keep partial data
    } finally {
      setLoadingDetail(false);
    }
  };

  const selectedCover = allCovers.find((c) => c.id === selectedCoverId) ?? selectedVn?.image ?? null;

  const handleApply = async () => {
    if (!selectedVn) return;
    setApplying(true);

    try {
      const [apiKey, proxyUrl, genreTags] = await Promise.all([
        database.getSetting("deepseek_api_key"),
        database.getSetting("proxy_url"),
        database.getGenreTags(),
      ]);

      const developer =
        selectedVn.developers?.length > 0
          ? selectedVn.developers.map((d) => d.name).join(", ")
          : game.developer;

      const coverPromise = (async () => {
        if (selectedCover?.url) {
          try {
            const ext = selectedCover.url.split(".").pop() || "jpg";
            return await invoke<string>("download_cover", {
              url: selectedCover.url,
              filename: `${selectedCover.id}.${ext}`,
              proxyUrl,
            });
          } catch (err) {
            toast("error", `「${selectedVn.title}」封面下载失败: ${err}`);
          }
        }
        return game.cover_path;
      })();

      const screenshotsPromise = (async () => {
        if (!selectedVn.screenshots?.length) return [];
        const results = await Promise.allSettled(
          selectedVn.screenshots.slice(0, 6).map((ss) => {
            const ext = ss.url.split(".").pop() || "jpg";
            return invoke<string>("download_screenshot", { url: ss.url, filename: `${ss.id}.${ext}`, proxyUrl });
          })
        );
        return results
          .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
          .map((r) => r.value);
      })();

      const descPromise = (async () => {
        if (game.notes) return game.notes;
        if (!selectedVn.description) return "";
        const cleaned = cleanDescription(selectedVn.description);
        if (apiKey) {
          try {
            return await translateDescription(cleaned, apiKey);
          } catch (err) {
            toast("warning", `简介翻译失败: ${err}`);
            return cleaned;
          }
        }
        return cleaned;
      })();

      const tagsPromise = (async () => {
        if (!apiKey) return [];
        const vndbTags = extractTags(selectedVn.tags || []);
        if (!vndbTags.length) return [];
        try {
          return await matchGenreTags(vndbTags, genreTags, apiKey);
        } catch {
          return [];
        }
      })();

      const [coverPath, screenshotPaths, translatedNotes, translatedTags] = await Promise.all([
        coverPromise,
        screenshotsPromise,
        descPromise,
        tagsPromise,
      ]);

      const update: Partial<GameFormData> = {
        title: game.title || pickDisplayTitle(selectedVn),
        title_original: pickOriginalTitle(selectedVn) || game.title_original,
        vndb_id: selectedVn.id,
        developer,
        release_date: formatVndbDate(selectedVn.released),
        cover_path: coverPath,
        screenshots: screenshotPaths.length > 0 ? screenshotPaths : game.screenshots,
        tags: translatedTags,
        vndb_rating: selectedVn.rating || 0,
        vndb_votecount: selectedVn.votecount || 0,
        length_minutes: selectedVn.length_minutes || 0,
        notes: translatedNotes,
      };

      onApply(update);
    } catch (err) {
      setError(`应用元数据失败: ${err}`);
    } finally {
      setApplying(false);
    }
  };

  const screenshots = selectedVn?.screenshots ?? [];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div
        className="absolute inset-0 dialog-overlay backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-3xl max-h-[85vh] bg-surface-1 border border-surface-3 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-3">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Globe className="w-5 h-5 text-accent" />
            VNDB 元数据匹配
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-surface-3 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-text-secondary" />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-6 py-3 border-b border-surface-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch()}
                placeholder="搜索游戏标题（支持日文/英文/中文）..."
                className="w-full pl-9 pr-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <button
              onClick={doSearch}
              disabled={searching || !query.trim()}
              className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {searching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "搜索"
              )}
            </button>
          </div>
          <p className="text-xs text-text-muted mt-1.5">
            当前游戏: <span className="text-text-secondary">{game.title}</span>
            {game.vndb_id && (
              <span className="ml-2 text-accent">已关联: {game.vndb_id}</span>
            )}
          </p>
        </div>

        {/* Content: split view */}
        <div className="flex-1 overflow-hidden flex min-h-0">
          {/* Left: search results */}
          <div className="w-1/2 border-r border-surface-3 overflow-y-auto">
            {error && (
              <div className="px-4 py-3 m-3 bg-status-shelved/10 border border-status-shelved/20 rounded-lg text-xs text-status-shelved">
                {error}
              </div>
            )}

            {searching ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 text-accent animate-spin" />
              </div>
            ) : results.length === 0 && !error ? (
              <div className="flex flex-col items-center justify-center py-16 text-text-muted">
                <Search className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-xs">输入标题后搜索</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {results.map((vn) => (
                  <button
                    key={vn.id}
                    onClick={() => selectVn(vn)}
                    className={cn(
                      "w-full flex gap-3 p-2.5 rounded-lg text-left transition-colors",
                      selectedVn?.id === vn.id
                        ? "bg-accent/15 border border-accent/30"
                        : "hover:bg-surface-2 border border-transparent"
                    )}
                  >
                    <div className="w-12 h-16 rounded overflow-hidden bg-surface-3 flex-shrink-0">
                      {vn.image?.url ? (
                        <img
                          src={vn.image.url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-text-muted">
                          {vn.id}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {vn.title}
                      </p>
                      {vn.alttitle && (
                        <p className="text-xs text-text-muted truncate">
                          {vn.alttitle}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-text-muted">
                          {vn.id}
                        </span>
                        {vn.released && vn.released !== "TBA" && (
                          <span className="text-[10px] text-text-muted">
                            {vn.released}
                          </span>
                        )}
                        {vn.rating && (
                          <span className="text-[10px] text-accent flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5" fill="currentColor" />
                            {(vn.rating / 10).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    {selectedVn?.id === vn.id && (
                      <Check className="w-4 h-4 text-accent flex-shrink-0 mt-1" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: detail preview */}
          <div className="w-1/2 overflow-y-auto">
            {selectedVn ? (
              <div className="p-4 space-y-4">
                {/* Cover picker */}
                {(allCovers.length > 0 || selectedVn.image?.url) && (
                  <div>
                    {/* Selected cover preview */}
                    <div className="rounded-lg overflow-hidden bg-surface-2 mb-2">
                      <img
                        src={selectedCover?.url ?? selectedVn.image?.url}
                        alt={selectedVn.title}
                        className="w-full max-h-64 object-contain bg-surface-3"
                      />
                    </div>

                    {/* Cover thumbnail strip — shown once at least 1 cover is available */}
                    <div>
                      <span className="text-[10px] text-text-muted flex items-center gap-1 mb-1.5">
                        选择封面
                        {loadingDetail ? (
                          <>
                            <Loader2 className="w-3 h-3 text-accent animate-spin" />
                            <span>加载中...</span>
                          </>
                        ) : (
                          <span>（{allCovers.length} 张）</span>
                        )}
                      </span>
                      <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {allCovers.map((c) => {
                          const typeLabel = c.type === "dig" ? "数字" : c.type === "pkgmed" ? "盘面" : null;
                          return (
                            <button
                              key={c.id}
                              onClick={() => setSelectedCoverId(c.id)}
                              title={c.type === "pkgfront" ? "实体封面" : c.type === "pkgmed" ? "盘面" : "数字版"}
                              className={cn(
                                "relative flex-shrink-0 w-14 h-20 rounded overflow-hidden border-2 transition-all",
                                selectedCoverId === c.id
                                  ? "border-accent shadow-sm shadow-accent/30 scale-[1.03]"
                                  : "border-transparent opacity-70 hover:opacity-100 hover:border-surface-4"
                              )}
                            >
                              <img src={c.url} alt="" className="w-full h-full object-cover" />
                              {typeLabel && (
                                <span className="absolute bottom-0 left-0 right-0 text-center text-[8px] bg-black/60 text-white/80 py-0.5">
                                  {typeLabel}
                                </span>
                              )}
                            </button>
                          );
                        })}
                        {/* Loading placeholder thumbnails */}
                        {loadingDetail && allCovers.length < 2 && (
                          <div className="flex-shrink-0 w-14 h-20 rounded bg-surface-3 animate-pulse" />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Title */}
                <div>
                  <h3 className="text-base font-semibold text-text-primary">
                    {pickDisplayTitle(selectedVn)}
                  </h3>
                  {pickOriginalTitle(selectedVn) && pickOriginalTitle(selectedVn) !== pickDisplayTitle(selectedVn) && (
                    <p className="text-sm text-text-muted mt-0.5">
                      {pickOriginalTitle(selectedVn)}
                    </p>
                  )}
                  {pickDisplayTitle(selectedVn) !== selectedVn.title && (
                    <p className="text-xs text-text-muted/70 mt-0.5">
                      {selectedVn.title}
                    </p>
                  )}
                  <a
                    href={`https://vndb.org/${selectedVn.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-accent hover:underline mt-1"
                    onClick={(e) => {
                      e.preventDefault();
                      import("@tauri-apps/plugin-shell").then((mod) =>
                        mod.open(`https://vndb.org/${selectedVn.id}`)
                      );
                    }}
                  >
                    <ExternalLink className="w-3 h-3" />
                    在 VNDB 查看
                  </a>
                </div>

                {/* Metadata table */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-text-muted">开发商</span>
                    {loadingDetail ? (
                      <Loader2 className="w-3 h-3 text-accent animate-spin" />
                    ) : selectedVn.developers && selectedVn.developers.length > 0 ? (
                      <span className="text-text-primary text-right">
                        {selectedVn.developers.map((d) => d.name).join(", ")}
                      </span>
                    ) : (
                      <span className="text-text-muted/50">—</span>
                    )}
                  </div>
                  {selectedVn.released && selectedVn.released !== "TBA" && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">发售日</span>
                      <span className="text-text-primary">{selectedVn.released}</span>
                    </div>
                  )}
                  {selectedVn.rating != null && selectedVn.rating > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-text-muted">VNDB 评分</span>
                      <span className="text-accent flex items-center gap-1">
                        <Star className="w-3 h-3" fill="currentColor" />
                        {(selectedVn.rating / 10).toFixed(2)}
                        <span className="text-text-muted">({selectedVn.votecount} 票)</span>
                      </span>
                    </div>
                  )}
                  {selectedVn.length_minutes != null && selectedVn.length_minutes > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-text-muted">平均游玩时长</span>
                      <span className="text-text-primary flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {Math.round(selectedVn.length_minutes / 60)}h
                        {selectedVn.length_minutes % 60 > 0 && `${selectedVn.length_minutes % 60}m`}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-text-muted">原始语言</span>
                    <span className="text-text-primary">{selectedVn.olang}</span>
                  </div>
                  {selectedVn.languages?.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">可用语言</span>
                      <span className="text-text-primary">
                        {selectedVn.languages.join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                {/* VNDB tags */}
                {selectedVn.tags && selectedVn.tags.length > 0 && (
                  <div>
                    <span className="text-xs text-text-muted flex items-center gap-1 mb-1.5">
                      <Tag className="w-3 h-3" />
                      VNDB 标签（仅供参考）
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {extractTags(selectedVn.tags).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-surface-3 text-text-muted text-[10px] rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                {selectedVn.description && (
                  <div>
                    <span className="text-xs text-text-muted mb-1 block">简介</span>
                    <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
                      {cleanDescription(selectedVn.description)}
                    </p>
                  </div>
                )}

                {/* Screenshots */}
                {screenshots.length > 0 && (
                  <div>
                    <span className="text-xs text-text-muted block mb-2">
                      截图预览（{screenshots.length} 张）
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {screenshots.map((ss, i) => (
                        <div
                          key={ss.id}
                          className="rounded-lg overflow-hidden bg-surface-2 aspect-video cursor-pointer"
                          onClick={() => setLightboxIdx(i)}
                        >
                          <img
                            src={ss.url}
                            alt=""
                            className="w-full h-full object-cover hover:opacity-80 transition-opacity"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* What will be updated */}
                <div className="p-3 bg-surface-2 rounded-lg text-xs space-y-1">
                  <p className="font-medium text-text-secondary mb-1.5">
                    将更新以下信息:
                  </p>
                  <div className="space-y-0.5 text-text-muted">
                    {selectedVn.alttitle && <p>✓ 原始标题</p>}
                    {selectedVn.developers && selectedVn.developers.length > 0 && (
                      <p>✓ 开发商</p>
                    )}
                    {selectedVn.released && <p>✓ 发售日期</p>}
                    {selectedCover?.url && <p>✓ 封面图片（已选择，自动下载）</p>}
                    {screenshots.length > 0 && (
                      <p>✓ 截图（自动下载，最多 6 张）</p>
                    )}
                    {selectedVn.tags?.length > 0 && <p>✓ 标签（合并）</p>}
                    {!game.notes && selectedVn.description && (
                      <p>✓ 备注（VNDB 简介）</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-text-muted">
                <Globe className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-xs">选择左侧搜索结果预览详情</p>
              </div>
            )}
          </div>
        </div>

        {/* Screenshot Lightbox */}
        {lightboxIdx !== null && screenshots.length > 0 && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 backdrop-blur-sm rounded-2xl"
            onClick={() => setLightboxIdx(null)}
          >
            <img
              src={screenshots[lightboxIdx]?.url}
              alt="截图放大"
              className="max-w-[85%] max-h-[80%] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxIdx(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
            {lightboxIdx > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => (i !== null ? i - 1 : null)); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
            )}
            {lightboxIdx < screenshots.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => (i !== null ? i + 1 : null)); }}
                className="absolute right-14 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
            )}
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/60">
              {lightboxIdx + 1} / {screenshots.length}
            </span>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-surface-3">
          <span className="text-[10px] text-text-muted">
            数据来源: vndb.org · 免费非商业使用
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleApply}
              disabled={!selectedVn || applying}
              className="flex items-center gap-2 px-5 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {applying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              应用元数据
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
