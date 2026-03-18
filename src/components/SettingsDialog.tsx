import { useState, useEffect, useRef } from "react";
import { X, Key, Loader2, CheckCircle2, AlertCircle, Tag, Plus, Palette, Check, RotateCcw, Globe, Info, RefreshCw, ArrowUpCircle, Download } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import * as db from "@/lib/database";
import { testApiKey } from "@/lib/deepseek";
import { useTheme, THEME_LIST } from "@/hooks/useTheme";
import { useAppearance, CARD_SIZE_OPTIONS, CARD_GAP_OPTIONS } from "@/hooks/useAppearance";

const GITHUB_REPO = "Chty-syq/GalAirport";

interface Props {
  onClose: () => void;
}

type SettingsTab = "appearance" | "api" | "tags" | "about";

interface UpdateInfo {
  has_update: boolean;
  latest_version: string;
  current_version: string;
  release_url: string;
  download_url: string;
}

export function SettingsDialog({ onClose, initialTab }: Props & { initialTab?: SettingsTab }) {
  const { theme, setTheme } = useTheme();
  const { appearance, setAppearance } = useAppearance();
  const [tab, setTab] = useState<SettingsTab>(initialTab ?? "appearance");
  const [deepseekKey, setDeepseekKey] = useState("");
  const [proxyUrl, setProxyUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "fail" | null>(null);
  const [testingVndb, setTestingVndb] = useState(false);
  const [vndbTestResult, setVndbTestResult] = useState<"success" | "fail" | null>(null);
  const [vndbLatency, setVndbLatency] = useState<number | null>(null);
  const [vndbTestError, setVndbTestError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // About / update check
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  // Download state
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ downloaded: number; total: number } | null>(null);
  const [downloadedPath, setDownloadedPath] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Magpie
  const [magpieEnabled, setMagpieEnabled] = useState(false);
  const [magpiePath, setMagpiePath] = useState("");

  // Genre tag library state
  const [genreTags, setGenreTagsState] = useState<string[]>([]);
  const [tagLoading, setTagLoading] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const newTagRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const [key, proxy, magpieOn] = await Promise.all([
        db.getSetting("deepseek_api_key"),
        db.getSetting("proxy_url"),
        db.getSetting("magpie_enabled"),
      ]);
      setDeepseekKey(key);
      setProxyUrl(proxy);
      setMagpieEnabled(magpieOn === "1");
      setLoading(false);
      // get magpie path (non-blocking)
      invoke<string>("get_magpie_exe_path").then(setMagpiePath).catch(() => {});
    })();
  }, []);

  useEffect(() => {
    if (tab === "tags") {
      setTagLoading(true);
      db.getGenreTags().then((tags) => {
        setGenreTagsState(tags);
        setTagLoading(false);
      });
    }
  }, [tab]);

  const saveGenreTags = async (tags: string[]) => {
    setGenreTagsState(tags);
    await db.setGenreTags(tags);
  };

  const handleAddTag = async () => {
    const val = newTagInput.trim();
    if (!val || genreTags.includes(val)) return;
    await saveGenreTags([...genreTags, val]);
    setNewTagInput("");
    newTagRef.current?.focus();
  };

  const handleRemoveTag = async (tag: string) => {
    await saveGenreTags(genreTags.filter((t) => t !== tag));
  };

  const handleResetTags = async () => {
    await saveGenreTags(db.DEFAULT_GENRE_TAGS);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const ok = await testApiKey(deepseekKey);
    setTestResult(ok ? "success" : "fail");
    setTesting(false);
  };

  const handleDownloadUpdate = async () => {
    if (!updateInfo?.download_url) return;
    setDownloading(true);
    setDownloadProgress(null);
    setDownloadedPath(null);
    setDownloadError(null);

    const unlisten = await listen<{ downloaded: number; total: number }>(
      "update_download_progress",
      (e) => setDownloadProgress(e.payload)
    );

    try {
      const path = await invoke<string>("download_update", {
        url: updateInfo.download_url,
        proxyUrl: proxyUrl.trim(),
      });
      setDownloadedPath(path);
    } catch (e) {
      setDownloadError(String(e));
    } finally {
      unlisten();
      setDownloading(false);
    }
  };

  const handleInstallUpdate = () => {
    if (!downloadedPath) return;
    invoke("install_update", { path: downloadedPath });
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateInfo(null);
    setUpdateError(null);
    try {
      const info = await invoke<UpdateInfo>("check_update", { proxyUrl: proxyUrl.trim() });
      setUpdateInfo(info);
    } catch (e) {
      setUpdateError(String(e));
    }
    setCheckingUpdate(false);
  };

  const handleTestVndb = async () => {
    setTestingVndb(true);
    setVndbTestResult(null);
    setVndbLatency(null);
    setVndbTestError(null);
    try {
      const ms = await invoke<number>("test_vndb_connection", { proxyUrl: proxyUrl.trim() });
      setVndbLatency(ms);
      setVndbTestResult("success");
    } catch (e) {
      setVndbTestResult("fail");
      setVndbTestError(String(e));
    }
    setTestingVndb(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await Promise.all([
      db.setSetting("deepseek_api_key", deepseekKey.trim()),
      db.setSetting("proxy_url", proxyUrl.trim()),
      db.setSetting("magpie_enabled", magpieEnabled ? "1" : "0"),
    ]);
    setSaving(false);
    onClose();
  };

  // (legacy compat — keep variable so JSX below compiles)
  const filteredTags = genreTags;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 dialog-overlay backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface-1 border border-surface-3 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-3 shrink-0">
          <h2 className="text-base font-semibold text-text-primary">设置</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-surface-3 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-text-secondary" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-3 px-6 shrink-0">
          <button
            onClick={() => setTab("appearance")}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              tab === "appearance"
                ? "border-accent text-accent"
                : "border-transparent text-text-muted hover:text-text-secondary"
            }`}
          >
            <Palette className="w-3 h-3 inline mr-1.5" />
            外观
          </button>
          <button
            onClick={() => setTab("api")}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              tab === "api"
                ? "border-accent text-accent"
                : "border-transparent text-text-muted hover:text-text-secondary"
            }`}
          >
            <Key className="w-3 h-3 inline mr-1.5" />
            配置
          </button>
          <button
            onClick={() => setTab("tags")}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              tab === "tags"
                ? "border-accent text-accent"
                : "border-transparent text-text-muted hover:text-text-secondary"
            }`}
          >
            <Tag className="w-3 h-3 inline mr-1.5" />
            标签
          </button>
          <button
            onClick={() => setTab("about")}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              tab === "about"
                ? "border-accent text-accent"
                : "border-transparent text-text-muted hover:text-text-secondary"
            }`}
          >
            <Info className="w-3 h-3 inline mr-1.5" />
            关于
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === "appearance" && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-text-secondary mb-1">主题风格</p>
                <p className="text-[10px] text-text-muted mb-4">选择你喜欢的界面配色，实时预览效果。</p>
                <div className="grid grid-cols-3 gap-3">
                  {THEME_LIST.map((t) => {
                    const selected = theme === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        className={`relative rounded-xl overflow-hidden border-2 transition-all focus:outline-none ${
                          selected
                            ? "border-accent shadow-lg shadow-accent/20 scale-[1.03]"
                            : "border-surface-3 hover:border-surface-4 hover:scale-[1.02]"
                        }`}
                        title={t.name}
                      >
                        {/* Mini app preview */}
                        <div
                          className="h-20 flex"
                          style={{ background: t.preview.bg }}
                        >
                          {/* Fake sidebar strip */}
                          <div
                            className="w-8 h-full flex flex-col items-center pt-2 gap-1.5"
                            style={{ background: t.preview.sidebar }}
                          >
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ background: t.preview.accent }}
                            />
                            <div className="w-4 h-0.5 rounded" style={{ background: t.preview.text, opacity: 0.2 }} />
                            <div className="w-4 h-0.5 rounded" style={{ background: t.preview.text, opacity: 0.15 }} />
                            <div className="w-4 h-0.5 rounded" style={{ background: t.preview.text, opacity: 0.1 }} />
                          </div>
                          {/* Fake content area */}
                          <div className="flex-1 p-2 flex flex-col gap-1.5">
                            {/* Fake card row */}
                            {[0.9, 0.6, 0.4].map((op, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-1.5"
                              >
                                <div
                                  className="w-5 h-5 rounded"
                                  style={{ background: t.preview.surface, opacity: op + 0.1 }}
                                />
                                <div className="flex-1 space-y-0.5">
                                  <div
                                    className="h-1 rounded"
                                    style={{ background: t.preview.text, opacity: op * 0.6 }}
                                  />
                                  <div
                                    className="h-0.5 rounded w-3/4"
                                    style={{ background: t.preview.text, opacity: op * 0.3 }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Theme name bar */}
                        <div
                          className="px-2.5 py-1.5 flex items-center justify-between"
                          style={{ background: t.preview.surface }}
                        >
                          <span
                            className="text-[10px] font-medium"
                            style={{ color: t.preview.text }}
                          >
                            {t.name}
                          </span>
                          {selected && (
                            <Check
                              className="w-3 h-3"
                              style={{ color: t.preview.accent }}
                            />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Card size */}
              <div className="border-t border-surface-3 pt-4">
                <p className="text-xs font-medium text-text-secondary mb-1">卡片大小</p>
                <p className="text-[10px] text-text-muted mb-3">调整游戏卡片在网格视图中的宽度。</p>
                <div className="flex gap-2">
                  {CARD_SIZE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setAppearance({ cardSize: opt.value })}
                      className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${
                        appearance.cardSize === opt.value
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-surface-3 text-text-muted hover:border-surface-4 hover:text-text-secondary"
                      }`}
                    >
                      {opt.label}
                      <span className="block text-[9px] font-normal opacity-60 mt-0.5">{opt.px}px</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Card gap */}
              <div className="border-t border-surface-3 pt-4">
                <p className="text-xs font-medium text-text-secondary mb-1">卡片间距</p>
                <p className="text-[10px] text-text-muted mb-3">调整网格视图中卡片之间的间隔。</p>
                <div className="flex gap-2">
                  {CARD_GAP_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setAppearance({ cardGap: opt.value })}
                      className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${
                        appearance.cardGap === opt.value
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-surface-3 text-text-muted hover:border-surface-4 hover:text-text-secondary"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "api" && (
            <>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 text-accent animate-spin" />
                </div>
              ) : (
                <div className="space-y-5">
                  {/* DeepSeek API Key */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-text-secondary mb-2">
                      <Key className="w-3.5 h-3.5" />
                      DeepSeek API Key
                    </label>
                    <p className="text-[10px] text-text-muted mb-2">
                      用于自动翻译游戏简介和标签为中文。可在{" "}
                      <span className="text-accent">platform.deepseek.com</span> 获取。
                    </p>
                    <input
                      type="text"
                      value={deepseekKey}
                      onChange={(e) => {
                        setDeepseekKey(e.target.value);
                        setTestResult(null);
                      }}
                      placeholder="sk-..."
                      className="w-full px-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={handleTest}
                        disabled={!deepseekKey.trim() || testing}
                        className="px-3 py-1.5 text-xs bg-surface-3 hover:bg-surface-4 disabled:opacity-40 text-text-secondary rounded-lg transition-colors"
                      >
                        {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : "测试连接"}
                      </button>
                      {testResult === "success" && (
                        <span className="text-[10px] text-status-finished flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> 连接成功
                        </span>
                      )}
                      {testResult === "fail" && (
                        <span className="text-[10px] text-status-shelved flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> 连接失败，请检查 Key
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Proxy */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-text-secondary mb-2">
                      <Globe className="w-3.5 h-3.5" />
                      代理设置
                    </label>
                    <p className="text-[10px] text-text-muted mb-2">
                      用于访问 VNDB 及下载封面/截图。留空则自动使用系统代理。
                      支持格式：<span className="text-accent">http://host:port</span>、<span className="text-accent">socks5://host:port</span>
                    </p>
                    <input
                      type="text"
                      value={proxyUrl}
                      onChange={(e) => {
                        setProxyUrl(e.target.value);
                        setVndbTestResult(null);
                        setVndbLatency(null);
                        setVndbTestError(null);
                      }}
                      placeholder="http://127.0.0.1:7890"
                      className="w-full px-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={handleTestVndb}
                        disabled={testingVndb}
                        className="px-3 py-1.5 text-xs bg-surface-3 hover:bg-surface-4 disabled:opacity-40 text-text-secondary rounded-lg transition-colors"
                      >
                        {testingVndb ? <Loader2 className="w-3 h-3 animate-spin" /> : "测试 VNDB 连接"}
                      </button>
                      {vndbTestResult === "success" && vndbLatency !== null && (
                        <span className={`text-[10px] flex items-center gap-1 ${vndbLatency < 500 ? "text-status-finished" : vndbLatency < 1500 ? "text-yellow-400" : "text-orange-400"}`}>
                          <CheckCircle2 className="w-3 h-3" /> 连接成功 · {vndbLatency} ms
                        </span>
                      )}
                      {vndbTestResult === "fail" && (
                        <span className="text-[10px] text-status-shelved flex items-center gap-1 max-w-[200px] truncate" title={vndbTestError ?? ""}>
                          <AlertCircle className="w-3 h-3 shrink-0" /> {vndbTestError ? vndbTestError.slice(0, 40) : "连接失败"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3 bg-surface-2 rounded-lg text-[10px] text-text-muted space-y-1">
                    <p>• VNDB：获取游戏基本信息、封面、截图、评分、标签（使用上方代理设置）</p>
                    <p>• DeepSeek：翻译简介 + 从标签库中匹配类型标签（需要 API Key，直连不走代理）</p>
                  </div>

                  {/* Magpie */}
                  <div className="border-t border-surface-3 pt-5 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
                          <span className="text-base leading-none">✨</span>
                          Magpie 超分辨率
                        </p>
                        <p className="text-[10px] text-text-muted mt-1 leading-relaxed">
                          启动游戏时自动运行 Magpie，使用 Win+Shift+A 激活窗口缩放。
                        </p>
                        {magpiePath ? (
                          <p className="text-[9px] text-text-muted/50 mt-1 font-mono truncate max-w-xs" title={magpiePath}>
                            {magpiePath}
                          </p>
                        ) : (
                          <p className="text-[9px] text-status-shelved mt-1">未找到 Magpie.exe</p>
                        )}
                      </div>
                      {/* Toggle */}
                      <button
                        onClick={() => setMagpieEnabled((v) => !v)}
                        disabled={!magpiePath}
                        className={`relative shrink-0 w-10 h-5.5 rounded-full transition-colors disabled:opacity-40 ${
                          magpieEnabled ? "bg-accent" : "bg-surface-4"
                        }`}
                        style={{ height: "22px" }}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            magpieEnabled ? "translate-x-[18px]" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    <button
                      onClick={() => invoke("launch_magpie")}
                      disabled={!magpiePath}
                      className="flex items-center gap-2 px-3 py-2 text-xs bg-surface-3 hover:bg-surface-4 disabled:opacity-40 text-text-secondary rounded-lg transition-colors"
                    >
                      <span className="text-sm leading-none">⚙</span>
                      打开 Magpie 进行配置
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === "tags" && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-text-secondary mb-1">类型标签库</p>
                <p className="text-[10px] text-text-muted mb-4">
                  导入游戏时，DeepSeek 会分析 VNDB 英文标签，从这里匹配适合的类型。
                </p>
              </div>

              {tagLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 text-accent animate-spin" />
                </div>
              ) : (
                <>
                  {/* Tag pills */}
                  <div className="flex flex-wrap gap-2 min-h-[60px] p-3 bg-surface-2 rounded-xl border border-surface-3">
                    {genreTags.map((tag) => (
                      <span
                        key={tag}
                        className="group inline-flex items-center gap-1 pl-3 pr-1.5 py-1 bg-accent/12 text-accent text-xs rounded-full border border-accent/20"
                      >
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-accent/20 transition-colors text-accent/60 hover:text-accent"
                          title="移除"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                    {genreTags.length === 0 && (
                      <span className="text-[10px] text-text-muted self-center">
                        暂无标签，请添加
                      </span>
                    )}
                  </div>

                  {/* Add input */}
                  <div className="flex gap-2">
                    <input
                      ref={newTagRef}
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                      placeholder="输入新标签，按 Enter 添加"
                      maxLength={10}
                      className="flex-1 px-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent"
                    />
                    <button
                      onClick={handleAddTag}
                      disabled={!newTagInput.trim() || genreTags.includes(newTagInput.trim())}
                      className="flex items-center gap-1.5 px-3 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      添加
                    </button>
                  </div>

                  {/* Reset */}
                  <button
                    onClick={handleResetTags}
                    className="flex items-center gap-1.5 text-[10px] text-text-muted hover:text-text-secondary transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    恢复默认标签库
                  </button>
                </>
              )}
            </div>
          )}
          {tab === "about" && (
            <div className="space-y-4">
              {/* Hero banner */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent/20 via-accent/10 to-transparent border border-accent/20 px-5 py-6">
                {/* Decorative circles */}
                <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-accent/10 blur-xl pointer-events-none" />
                <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-accent/8 blur-lg pointer-events-none" />

                <div className="relative flex items-center gap-4">
                  {/* Icon */}
                  <div className="shrink-0 w-16 h-16 rounded-2xl shadow-lg overflow-hidden bg-gradient-to-br from-[#3b1f6e] to-[#6b3fa0] flex items-center justify-center border border-white/10">
                    <svg viewBox="0 0 256 256" width="56" height="56" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="abt-hair" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#ff8ecb"/>
                          <stop offset="100%" stopColor="#c45aff"/>
                        </linearGradient>
                        <linearGradient id="abt-sky" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1a0a2e"/>
                          <stop offset="100%" stopColor="#6b3fa0"/>
                        </linearGradient>
                      </defs>
                      <rect width="256" height="256" fill="url(#abt-sky)"/>
                      {/* Stars */}
                      <circle cx="30" cy="30" r="2" fill="white" opacity="0.8"/>
                      <circle cx="60" cy="18" r="1.5" fill="white" opacity="0.7"/>
                      <circle cx="200" cy="22" r="2" fill="#ffe4f7" opacity="0.9"/>
                      <circle cx="230" cy="40" r="1.5" fill="white" opacity="0.7"/>
                      {/* Moon */}
                      <circle cx="215" cy="42" r="16" fill="#f0d8ff" opacity="0.9"/>
                      <circle cx="222" cy="35" r="12" fill="#3b1f6e"/>
                      {/* Plane */}
                      <g transform="translate(158,68) rotate(-22)">
                        <ellipse cx="0" cy="0" rx="26" ry="6" fill="white" opacity="0.95"/>
                        <polygon points="-22,-6 -18,-16 -13,-6" fill="white" opacity="0.9"/>
                        <polygon points="-4,-6 9,-6 16,12 0,9" fill="white" opacity="0.9"/>
                        <polygon points="-4,6 9,6 16,-12 0,-9" fill="white" opacity="0.9"/>
                      </g>
                      {/* Runway */}
                      <rect x="0" y="224" width="256" height="32" fill="#12043a" opacity="0.9"/>
                      <rect x="50" y="230" width="18" height="3" rx="1.5" fill="#c4b5fd" opacity="0.7"/>
                      <rect x="82" y="230" width="18" height="3" rx="1.5" fill="#c4b5fd" opacity="0.7"/>
                      <rect x="114" y="230" width="18" height="3" rx="1.5" fill="#c4b5fd" opacity="0.7"/>
                      <rect x="146" y="230" width="18" height="3" rx="1.5" fill="#c4b5fd" opacity="0.7"/>
                      {/* Girl silhouette */}
                      <ellipse cx="100" cy="116" rx="18" ry="20" fill="#ffe0c8"/>
                      <path d="M 84,104 Q 82,88 90,80 Q 98,74 106,74 Q 116,74 122,82 Q 128,90 124,104 Q 118,93 110,91 Q 100,89 92,92 Q 86,96 84,104 Z" fill="url(#abt-hair)"/>
                      <path d="M 84,104 Q 74,118 72,148 Q 76,168 82,172 Q 84,154 88,130 Z" fill="url(#abt-hair)" opacity="0.9"/>
                      <path d="M 116,104 Q 126,118 128,148 Q 124,168 118,172 Q 116,154 112,130 Z" fill="url(#abt-hair)" opacity="0.9"/>
                      <path d="M 86,138 Q 82,158 84,172 L 116,172 Q 118,158 114,138 Q 106,133 100,132 Q 94,133 86,138 Z" fill="#4a9fd4"/>
                      <path d="M 84,172 Q 84,196 90,198 Q 100,201 110,198 Q 116,196 116,172 Z" fill="#3a8fd4"/>
                      <ellipse cx="100" cy="98" rx="20" ry="4.5" fill="#2d5a9e"/>
                      <rect x="86" y="88" width="28" height="11" rx="3" fill="#3a6fd4"/>
                      <rect x="82" y="96" width="36" height="3.5" rx="1.5" fill="#2d5a9e"/>
                      <polygon points="100,90 101.2,93 105,93 102,95 103,98 100,96 97,98 98,95 95,93 98.8,93" fill="#ffe066" opacity="0.95"/>
                      <ellipse cx="92" cy="116" rx="4.5" ry="5" fill="#1a0060"/>
                      <ellipse cx="92" cy="116" rx="3" ry="3.5" fill="#7b2fff"/>
                      <circle cx="90.5" cy="114" r="1.3" fill="white" opacity="0.9"/>
                      <ellipse cx="108" cy="116" rx="4.5" ry="5" fill="#1a0060"/>
                      <ellipse cx="108" cy="116" rx="3" ry="3.5" fill="#7b2fff"/>
                      <circle cx="106.5" cy="114" r="1.3" fill="white" opacity="0.9"/>
                      <path d="M 97,127 Q 100,130 103,127" stroke="#e8607a" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                    </svg>
                  </div>

                  {/* App info */}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-bold text-text-primary tracking-wide">GalAirport</h2>
                    <p className="text-[11px] text-text-secondary mt-0.5">本地 Galgame 库管理工具</p>
                    <div className="flex items-center gap-2 mt-2">
                      {updateInfo && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-accent/20 text-accent text-[10px] font-medium border border-accent/30">
                          v{updateInfo.current_version}
                        </span>
                      )}
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-3 text-text-muted text-[10px]">
                        Tauri · React
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Update check */}
              <div className="rounded-xl border border-surface-3 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-surface-2">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 text-accent" />
                    <span className="text-xs font-medium text-text-secondary">版本更新</span>
                  </div>
                  <button
                    onClick={handleCheckUpdate}
                    disabled={checkingUpdate}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] bg-surface-3 hover:bg-surface-4 disabled:opacity-40 text-text-secondary rounded-lg transition-colors"
                  >
                    <RefreshCw className={`w-3 h-3 ${checkingUpdate ? "animate-spin" : ""}`} />
                    {checkingUpdate ? "检查中…" : "检查更新"}
                  </button>
                </div>

                {/* 已是最新 */}
                {updateInfo && !updateInfo.has_update && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-surface-1 border-t border-surface-3">
                    <div className="w-7 h-7 rounded-full bg-status-finished/15 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-status-finished" />
                    </div>
                    <div>
                      <p className="text-xs text-text-secondary font-medium">已是最新版本</p>
                      <p className="text-[10px] text-text-muted mt-0.5">{updateInfo.current_version}</p>
                    </div>
                  </div>
                )}

                {/* 有新版本 */}
                {updateInfo?.has_update && (
                  <div className="px-4 py-3 space-y-3 bg-surface-1 border-t border-accent/20">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
                        <ArrowUpCircle className="w-3.5 h-3.5 text-accent" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-text-primary font-medium">发现新版本 <span className="text-accent">{updateInfo.latest_version}</span></p>
                        <p className="text-[10px] text-text-muted mt-0.5">当前 {updateInfo.current_version}</p>
                      </div>
                    </div>

                    {/* 下载进度条 */}
                    {downloading && downloadProgress && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] text-text-muted">
                          <span>下载中…</span>
                          <span>
                            {downloadProgress.total > 0
                              ? `${Math.round((downloadProgress.downloaded / downloadProgress.total) * 100)}%`
                              : `${(downloadProgress.downloaded / 1024 / 1024).toFixed(1)} MB`}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-accent to-accent-hover rounded-full transition-all duration-200"
                            style={{
                              width: downloadProgress.total > 0
                                ? `${(downloadProgress.downloaded / downloadProgress.total) * 100}%`
                                : "100%",
                            }}
                          />
                        </div>
                      </div>
                    )}
                    {downloading && !downloadProgress && (
                      <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
                        <Loader2 className="w-3 h-3 animate-spin" /> 连接中…
                      </div>
                    )}

                    {/* 下载错误 */}
                    {downloadError && (
                      <div className="flex items-center gap-1.5 text-[10px] text-status-shelved">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span className="truncate" title={downloadError}>{downloadError}</span>
                      </div>
                    )}

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {!downloadedPath && (
                        <button
                          onClick={handleDownloadUpdate}
                          disabled={downloading || !updateInfo.download_url}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg transition-colors shadow-sm"
                        >
                          {downloading
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Download className="w-3 h-3" />}
                          {downloading ? "下载中…" : "下载更新"}
                        </button>
                      )}
                      {downloadedPath && (
                        <button
                          onClick={handleInstallUpdate}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors shadow-sm"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          立即安装
                        </button>
                      )}
                      {!updateInfo.download_url && (
                        <button
                          onClick={() => invoke("open_url", { url: updateInfo.release_url })}
                          className="text-[10px] text-accent hover:underline"
                        >
                          前往下载页面 →
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {updateError && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-surface-1 border-t border-surface-3 text-xs">
                    <AlertCircle className="w-4 h-4 text-status-shelved shrink-0" />
                    <span className="text-text-muted truncate" title={updateError}>{updateError}</span>
                  </div>
                )}
              </div>

              {/* Links */}
              <div className="rounded-xl border border-surface-3 overflow-hidden">
                <button
                  onClick={() => invoke("open_url", { url: `https://github.com/${GITHUB_REPO}` })}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-surface-2 hover:bg-surface-3 transition-colors text-left group"
                >
                  <div className="w-7 h-7 rounded-lg bg-surface-3 group-hover:bg-surface-4 flex items-center justify-center shrink-0 transition-colors">
                    <Globe className="w-3.5 h-3.5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-secondary font-medium">GitHub 仓库</p>
                    <p className="text-[10px] text-text-muted truncate">github.com/{GITHUB_REPO}</p>
                  </div>
                  <ArrowUpCircle className="w-3 h-3 text-text-muted rotate-45 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <div className="h-px bg-surface-3" />
                <button
                  onClick={() => invoke("open_url", { url: `https://github.com/${GITHUB_REPO}/releases` })}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-surface-2 hover:bg-surface-3 transition-colors text-left group"
                >
                  <div className="w-7 h-7 rounded-lg bg-surface-3 group-hover:bg-surface-4 flex items-center justify-center shrink-0 transition-colors">
                    <ArrowUpCircle className="w-3.5 h-3.5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-secondary font-medium">发布历史</p>
                    <p className="text-[10px] text-text-muted">查看所有发布版本</p>
                  </div>
                  <ArrowUpCircle className="w-3 h-3 text-text-muted rotate-45 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>

              {/* Footer */}
              <p className="text-center text-[10px] text-text-muted pb-1">
                Made with ♥ · MIT License
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-surface-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
          >
            {tab === "api" ? "取消" : "关闭"}
          </button>
          {tab === "api" && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "保存"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}