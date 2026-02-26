import { useState, useEffect } from "react";
import { X, FolderSearch, Star } from "lucide-react";
import type { Game, GameFormData, PlayStatus } from "@/types/game";
import { open } from "@tauri-apps/plugin-dialog";
import { cn } from "@/lib/utils";

interface Props {
  game: Game | null; // null = adding new
  onSave: (data: GameFormData) => void;
  onClose: () => void;
}

const defaultForm: GameFormData = {
  title: "",
  title_original: "",
  vndb_id: "",
  developer: "",
  release_date: "",
  exe_path: "",
  install_path: "",
  save_path: "",
  cover_path: "",
  screenshots: [],
  tags: [],
  play_status: "unplayed",
  rating: 0,
  vndb_rating: 0,
  notes: "",
  engine: "",
};

const STATUS_OPTIONS: { value: PlayStatus; label: string }[] = [
  { value: "unplayed", label: "未开始" },
  { value: "playing", label: "游玩中" },
  { value: "finished", label: "已通关" },
  { value: "shelved", label: "已搁置" },
];

export function GameForm({ game, onSave, onClose }: Props) {
  const [form, setForm] = useState<GameFormData>(defaultForm);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (game) {
      setForm({
        title: game.title,
        title_original: game.title_original,
        vndb_id: game.vndb_id || "",
        developer: game.developer,
        release_date: game.release_date,
        exe_path: game.exe_path,
        install_path: game.install_path,
        save_path: game.save_path,
        cover_path: game.cover_path,
        screenshots: [...(game.screenshots || [])],
        tags: [...game.tags],
        play_status: game.play_status,
        rating: game.rating,
        vndb_rating: game.vndb_rating || 0,
        notes: game.notes,
        engine: game.engine,
      });
    }
  }, [game]);

  const set = <K extends keyof GameFormData>(key: K, value: GameFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const browseExe = async () => {
    const result = await open({
      title: "选择游戏可执行文件",
      filters: [{ name: "可执行文件", extensions: ["exe"] }],
    });
    if (result) {
      const path = typeof result === "string" ? result : result;
      set("exe_path", path as string);
      // Auto-fill install path & title from exe path
      const parts = (path as string).replace(/\\/g, "/").split("/");
      parts.pop(); // remove filename
      const installPath = parts.join("\\");
      if (!form.install_path) set("install_path", installPath);
      if (!form.title) {
        const dirName = parts[parts.length - 1] || "";
        set("title", dirName);
      }
    }
  };

  const browseFolder = async (field: "install_path" | "save_path") => {
    const result = await open({ directory: true, title: "选择文件夹" });
    if (result) {
      set(field, result as string);
    }
  };

  const browseCover = async () => {
    const result = await open({
      title: "选择封面图片",
      filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "webp", "bmp"] }],
    });
    if (result) {
      set("cover_path", result as string);
    }
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      set("tags", [...form.tags, tag]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    set("tags", form.tags.filter((t) => t !== tag));
  };

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 dialog-overlay backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-xl max-h-[85vh] bg-surface-1 border border-surface-3 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-3">
          <h2 className="text-lg font-semibold text-text-primary">
            {game ? "编辑游戏" : "添加游戏"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-surface-3 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-text-secondary" />
          </button>
        </div>

        {/* Scrollable form */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs text-text-muted mb-1.5">游戏标题 *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="例: WHITE ALBUM2"
              className="w-full px-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Original title */}
          <div>
            <label className="block text-xs text-text-muted mb-1.5">原始标题</label>
            <input
              type="text"
              value={form.title_original}
              onChange={(e) => set("title_original", e.target.value)}
              placeholder="例: ホワイトアルバム2"
              className="w-full px-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1.5">开发商</label>
              <input
                type="text"
                value={form.developer}
                onChange={(e) => set("developer", e.target.value)}
                placeholder="例: Leaf"
                className="w-full px-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1.5">发售日期</label>
              <input
                type="date"
                value={form.release_date}
                onChange={(e) => set("release_date", e.target.value)}
                className="w-full px-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>

          {/* Exe path */}
          <div>
            <label className="block text-xs text-text-muted mb-1.5">可执行文件路径</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.exe_path}
                onChange={(e) => set("exe_path", e.target.value)}
                placeholder="点击右侧按钮浏览..."
                className="flex-1 px-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent transition-colors"
              />
              <button
                onClick={browseExe}
                className="px-3 py-2 bg-surface-3 hover:bg-surface-4 rounded-lg text-sm text-text-secondary transition-colors"
              >
                <FolderSearch className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Install path */}
          <div>
            <label className="block text-xs text-text-muted mb-1.5">安装目录</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.install_path}
                onChange={(e) => set("install_path", e.target.value)}
                className="flex-1 px-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent transition-colors"
              />
              <button
                onClick={() => browseFolder("install_path")}
                className="px-3 py-2 bg-surface-3 hover:bg-surface-4 rounded-lg text-sm text-text-secondary transition-colors"
              >
                <FolderSearch className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Cover */}
          <div>
            <label className="block text-xs text-text-muted mb-1.5">封面图片</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.cover_path}
                onChange={(e) => set("cover_path", e.target.value)}
                placeholder="选择本地图片文件"
                className="flex-1 px-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent transition-colors"
              />
              <button
                onClick={browseCover}
                className="px-3 py-2 bg-surface-3 hover:bg-surface-4 rounded-lg text-sm text-text-secondary transition-colors"
              >
                <FolderSearch className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Engine */}
          <div>
            <label className="block text-xs text-text-muted mb-1.5">游戏引擎</label>
            <input
              type="text"
              value={form.engine}
              onChange={(e) => set("engine", e.target.value)}
              placeholder="例: KiriKiri, Unity"
              className="w-full px-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Play status */}
          <div>
            <label className="block text-xs text-text-muted mb-1.5">游玩状态</label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => set("play_status", opt.value)}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors border",
                    form.play_status === opt.value
                      ? "bg-accent/20 border-accent text-accent"
                      : "bg-surface-2 border-surface-3 text-text-secondary hover:bg-surface-3"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rating */}
          <div>
            <label className="block text-xs text-text-muted mb-1.5">
              评分: {form.rating}/10
            </label>
            <div className="flex gap-1">
              {Array.from({ length: 10 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => set("rating", i + 1)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={cn(
                      "w-5 h-5",
                      i < form.rating ? "text-yellow-400" : "text-surface-4"
                    )}
                    fill={i < form.rating ? "currentColor" : "none"}
                  />
                </button>
              ))}
              {form.rating > 0 && (
                <button
                  onClick={() => set("rating", 0)}
                  className="ml-2 text-xs text-text-muted hover:text-text-secondary"
                >
                  清除
                </button>
              )}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs text-text-muted mb-1.5">标签</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTag()}
                placeholder="输入标签后回车"
                className="flex-1 px-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent transition-colors"
              />
              <button
                onClick={addTag}
                className="px-3 py-2 bg-surface-3 hover:bg-surface-4 rounded-lg text-sm text-text-secondary transition-colors"
              >
                添加
              </button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-accent/10 text-accent text-xs rounded-full"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="hover:text-white transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {["汉化", "生肉", "机翻", "纯爱", "校园", "幻想", "悬疑", "百合"]
                .filter((t) => !form.tags.includes(t))
                .map((tag) => (
                  <button
                    key={tag}
                    onClick={() => set("tags", [...form.tags, tag])}
                    className="px-2 py-0.5 bg-surface-3 hover:bg-surface-4 text-text-muted text-xs rounded-full transition-colors"
                  >
                    + {tag}
                  </button>
                ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-text-muted mb-1.5">备注</label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              placeholder="个人笔记、攻略要点等..."
              className="w-full px-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent transition-colors resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-surface-3">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!form.title.trim()}
            className="px-5 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {game ? "保存修改" : "添加游戏"}
          </button>
        </div>
      </div>
    </div>
  );
}