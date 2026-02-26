import { useState, useEffect } from "react";
import { X, Key, Loader2, CheckCircle2, AlertCircle, Tag, Trash2, Save } from "lucide-react";
import * as db from "@/lib/database";
import type { TagTranslation } from "@/lib/database";
import { testApiKey } from "@/lib/deepseek";

interface Props {
  onClose: () => void;
}

type SettingsTab = "api" | "tags";

export function SettingsDialog({ onClose }: Props) {
  const [tab, setTab] = useState<SettingsTab>("api");
  const [deepseekKey, setDeepseekKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "fail" | null>(null);
  const [saving, setSaving] = useState(false);

  // Tag translations state
  const [tagList, setTagList] = useState<TagTranslation[]>([]);
  const [tagLoading, setTagLoading] = useState(false);
  const [editedTags, setEditedTags] = useState<Map<string, string>>(new Map());
  const [tagFilter, setTagFilter] = useState("");
  const [tagSaving, setTagSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const key = await db.getSetting("deepseek_api_key");
      setDeepseekKey(key);
      setLoading(false);
    })();
  }, []);

  // Load tags when switching to tags tab
  useEffect(() => {
    if (tab === "tags") {
      loadTags();
    }
  }, [tab]);

  const loadTags = async () => {
    setTagLoading(true);
    const tags = await db.getAllTagTranslations();
    setTagList(tags);
    setEditedTags(new Map());
    setTagLoading(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const ok = await testApiKey(deepseekKey);
    setTestResult(ok ? "success" : "fail");
    setTesting(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await db.setSetting("deepseek_api_key", deepseekKey.trim());
    setSaving(false);
    onClose();
  };

  const handleTagEdit = (en: string, newZh: string) => {
    setEditedTags((prev) => {
      const next = new Map(prev);
      next.set(en, newZh);
      return next;
    });
  };

  const handleTagSave = async () => {
    if (editedTags.size === 0) return;
    setTagSaving(true);
    const pairs: TagTranslation[] = [];
    for (const [en, zh] of editedTags) {
      pairs.push({ en, zh });
    }
    await db.setTagTranslations(pairs);
    // Update local list
    setTagList((prev) =>
      prev.map((t) => (editedTags.has(t.en) ? { ...t, zh: editedTags.get(t.en)! } : t))
    );
    setEditedTags(new Map());
    setTagSaving(false);
  };

  const handleTagDelete = async (en: string) => {
    await db.deleteTagTranslation(en);
    setTagList((prev) => prev.filter((t) => t.en !== en));
    setEditedTags((prev) => {
      const next = new Map(prev);
      next.delete(en);
      return next;
    });
  };

  const filteredTags = tagFilter
    ? tagList.filter(
        (t) =>
          t.en.toLowerCase().includes(tagFilter.toLowerCase()) ||
          t.zh.includes(tagFilter)
      )
    : tagList;

  const hasEdits = editedTags.size > 0;

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
            标签翻译
            {tagList.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-surface-3 text-text-muted rounded text-[10px]">
                {tagList.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
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

                  {/* Info */}
                  <div className="p-3 bg-surface-2 rounded-lg text-[10px] text-text-muted space-y-1">
                    <p>• VNDB：获取游戏基本信息、封面、截图、评分、标签（无需配置）</p>
                    <p>• DeepSeek：自动翻译简介和标签为中文（需要 API Key）</p>
                    <p>• 标签翻译结果会缓存到本地，可在「标签翻译」页自定义修改</p>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === "tags" && (
            <div className="space-y-3">
              {tagLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 text-accent animate-spin" />
                </div>
              ) : tagList.length === 0 ? (
                <div className="text-center py-8">
                  <Tag className="w-8 h-8 text-text-muted/30 mx-auto mb-2" />
                  <p className="text-xs text-text-muted">暂无翻译缓存</p>
                  <p className="text-[10px] text-text-muted/60 mt-1">
                    导入游戏时自动翻译的标签会显示在此处
                  </p>
                </div>
              ) : (
                <>
                  {/* Search */}
                  <input
                    type="text"
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value)}
                    placeholder="搜索标签..."
                    className="w-full px-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent"
                  />

                  {/* Tag list */}
                  <div className="space-y-1">
                    {filteredTags.map((t) => {
                      const currentZh = editedTags.has(t.en) ? editedTags.get(t.en)! : t.zh;
                      return (
                        <div
                          key={t.en}
                          className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-2 group"
                        >
                          <span className="text-[10px] text-text-muted w-28 shrink-0 truncate" title={t.en}>
                            {t.en}
                          </span>
                          <span className="text-text-muted text-[10px]">→</span>
                          <input
                            type="text"
                            value={currentZh}
                            onChange={(e) => handleTagEdit(t.en, e.target.value)}
                            className="flex-1 px-2 py-1 bg-transparent border border-transparent focus:border-surface-3 focus:bg-surface-2 rounded text-xs text-text-primary focus:outline-none transition-colors"
                          />
                          <button
                            onClick={() => handleTagDelete(t.en)}
                            className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-text-muted hover:text-status-shelved transition-all"
                            title="删除"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {filteredTags.length === 0 && tagFilter && (
                    <p className="text-xs text-text-muted text-center py-4">
                      未找到匹配「{tagFilter}」的标签
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center gap-3 px-6 py-4 border-t border-surface-3 shrink-0">
          {tab === "tags" && hasEdits ? (
            <>
              <span className="text-[10px] text-accent">
                {editedTags.size} 项修改未保存
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditedTags(new Map())}
                  className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
                >
                  放弃修改
                </button>
                <button
                  onClick={handleTagSave}
                  disabled={tagSaving}
                  className="flex items-center gap-1.5 px-5 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg"
                >
                  {tagSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-3.5 h-3.5" /> 保存修改</>}
                </button>
              </div>
            </>
          ) : (
            <>
              <div />
              <div className="flex gap-3">
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}