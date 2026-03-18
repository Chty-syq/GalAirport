import { useState, useEffect, useRef } from "react";
import { Tag, X, Settings, FolderOpen, HelpCircle, Layers, Upload } from "lucide-react";
import type { Collection, PlayStatus } from "@/types/game";
import { cn } from "@/lib/utils";
import * as db from "@/lib/database";

interface TagInfo {
  tag: string;
  count: number;
}

interface Props {
  gameCount: number;
  filterStatus: PlayStatus | "all";
  onFilterStatusChange: (s: PlayStatus | "all") => void;  // pass "all" to clear
  filterTags: string[];
  onFilterTagsChange: (tags: string[]) => void;
  allTags: TagInfo[];
  collections: Collection[];
  filterCollection: string | null;
  onFilterCollection: (id: string | null) => void;
  showAllGames: boolean;
  onToggleShowAllGames: () => void;
  allGames: { collection_id: string | null }[];
  onSettings: () => void;
  onHelp: () => void;
}

const STATUS_OPTIONS: { value: PlayStatus; label: string; dot: string }[] = [
  { value: "unplayed", label: "未开始", dot: "bg-status-unplayed" },
  { value: "playing", label: "游玩中", dot: "bg-status-playing" },
  { value: "finished", label: "已通关", dot: "bg-status-finished" },
  { value: "completed", label: "全线通关", dot: "bg-status-completed" },
];

export function Sidebar({
  gameCount,
  filterStatus,
  onFilterStatusChange,
  filterTags,
  onFilterTagsChange,
  allTags,
  collections,
  filterCollection,
  onFilterCollection,
  showAllGames,
  onToggleShowAllGames,
  allGames,
  onSettings,
  onHelp,
}: Props) {
  const [avatar, setAvatar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    db.getSetting("sidebar_avatar").then((val) => { if (val) setAvatar(val); });
  }, []);

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setAvatar(dataUrl);
      db.setSetting("sidebar_avatar", dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const toggleTag = (tag: string) => {
    if (filterTags.includes(tag)) {
      onFilterTagsChange(filterTags.filter((t) => t !== tag));
    } else {
      onFilterTagsChange([...filterTags, tag]);
    }
  };

  const getCollectionCount = (id: string) =>
    allGames.filter((g) => g.collection_id === id).length;

  return (
    <aside className="w-56 flex-shrink-0 bg-surface-1 border-r border-surface-3/50 flex flex-col h-full overflow-hidden">
      {/* Brand */}
      <div className="px-5 pt-5 pb-4" data-tauri-drag-region>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <button
            onClick={handleAvatarClick}
            className="relative group w-12 h-12 rounded-2xl flex-shrink-0 overflow-hidden bg-accent/15 flex items-center justify-center focus:outline-none"
            title="点击更换头像"
          >
            {avatar ? (
              <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-accent select-none">G</span>
            )}
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Upload className="w-4 h-4 text-white" />
            </div>
          </button>
          <div>
            <h1 className="text-sm font-bold text-text-primary tracking-wide">
              GalAirport
            </h1>
            <p className="text-[10px] text-text-muted">
              {gameCount} 个游戏
            </p>
          </div>
        </div>
      </div>

      {/* Status filter */}
      <div className="px-3 pb-2">
        <p className="px-2 mb-1.5 text-[10px] font-medium text-text-muted/60 uppercase tracking-wider">
          状态
        </p>
        <nav className="space-y-0.5">
          {STATUS_OPTIONS.map((opt) => {
            const active = filterStatus === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onFilterStatusChange(active ? "all" : opt.value)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs transition-colors",
                  active
                    ? "bg-accent/10 text-accent font-medium"
                    : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                )}
              >
                <span className={cn("w-2 h-2 rounded-full flex-shrink-0", opt.dot)} />
                {opt.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Divider */}
      <div className="mx-5 border-t border-surface-3/60 my-2" />

      {/* Collection filter */}
      <div className="px-3 pb-2">
        <div className="px-2 mb-1.5 flex items-center justify-between">
          <p className="text-[10px] font-medium text-text-muted/60 uppercase tracking-wider flex items-center gap-1">
            <FolderOpen className="w-3 h-3" />
            合集
          </p>
          <button
            onClick={onToggleShowAllGames}
            title={showAllGames ? "点击：仅显示未分类" : "点击：显示全部游戏"}
            className={cn(
              "flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors",
              showAllGames
                ? "bg-accent/15 text-accent"
                : "text-text-muted/50 hover:text-text-muted"
            )}
          >
            <Layers className="w-3 h-3" />
            全部
          </button>
        </div>
        {collections.length === 0 ? (
          <p className="text-[10px] text-text-muted/50 px-2 py-1">
            暂无合集
          </p>
        ) : (
          <nav className="space-y-0.5">
            {collections.map((col) => {
              const count = getCollectionCount(col.id);
              const active = filterCollection === col.id;
              return (
                <button
                  key={col.id}
                  onClick={() => onFilterCollection(active ? null : col.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors",
                    active
                      ? "bg-accent/10 text-accent font-medium"
                      : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      active ? "bg-accent" : "bg-text-muted/30"
                    )} />
                    <span className="truncate">{col.name}</span>
                  </div>
                  <span className="text-[10px] text-text-muted/50 flex-shrink-0 ml-2">
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        )}
      </div>

      {/* Divider */}
      <div className="mx-5 border-t border-surface-3/60 my-2" />

      {/* Tag filter */}
      <div className="px-3 flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="flex items-center justify-between px-2 mb-1.5">
          <p className="text-[10px] font-medium text-text-muted/60 uppercase tracking-wider flex items-center gap-1">
            <Tag className="w-3 h-3" />
            标签
          </p>
          {filterTags.length > 0 && (
            <button
              onClick={() => onFilterTagsChange([])}
              className="text-[10px] text-accent hover:text-accent-hover transition-colors"
            >
              清除
            </button>
          )}
        </div>

        {/* Active tag chips */}
        {filterTags.length > 0 && (
          <div className="flex flex-wrap gap-1 px-2 mb-2">
            {filterTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className="flex items-center gap-1 px-2 py-0.5 bg-accent/15 text-accent text-[10px] rounded-full hover:bg-accent/25 transition-colors"
              >
                {tag}
                <X className="w-2.5 h-2.5" />
              </button>
            ))}
          </div>
        )}

        {/* Tag list */}
        <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
          {allTags.length === 0 ? (
            <p className="text-[10px] text-text-muted/50 px-2 py-3 text-center">
              暂无标签
            </p>
          ) : (
            allTags.map(({ tag, count }) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-1 rounded-md text-[11px] transition-colors",
                  filterTags.includes(tag)
                    ? "bg-accent/10 text-accent font-medium"
                    : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                )}
              >
                <span className="truncate">{tag}</span>
                <span className="text-[10px] text-text-muted/50 flex-shrink-0 ml-2">
                  {count}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 底部操作 */}
      <div className="px-3 py-3 border-t border-surface-3/60 space-y-0.5">
        <button
          onClick={onSettings}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          设置
        </button>
        <button
          onClick={onHelp}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          使用帮助
        </button>
      </div>
    </aside>
  );
}
