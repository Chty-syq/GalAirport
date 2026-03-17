import { useState, useEffect, useRef } from "react";
import { X, Key, Loader2, CheckCircle2, AlertCircle, Tag, Plus, Palette, Check, RotateCcw, Globe } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import * as db from "@/lib/database";
import { testApiKey } from "@/lib/deepseek";
import { useTheme, THEME_LIST } from "@/hooks/useTheme";

interface Props {
  onClose: () => void;
}

type SettingsTab = "appearance" | "api" | "tags";

export function SettingsDialog({ onClose, initialTab }: Props & { initialTab?: SettingsTab }) {
  const { theme, setTheme } = useTheme();
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

  // Genre tag library state
  const [genreTags, setGenreTagsState] = useState<string[]>([]);
  const [tagLoading, setTagLoading] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const newTagRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const [key, proxy] = await Promise.all([
        db.getSetting("deepseek_api_key"),
        db.getSetting("proxy_url"),
      ]);
      setDeepseekKey(key);
      setProxyUrl(proxy);
      setLoading(false);
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
            API 配置
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
            标签库
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