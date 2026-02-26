import { Gamepad2, Tag, X, Sun, Moon, Settings } from "lucide-react";
import type { PlayStatus } from "@/types/game";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";

interface TagInfo {
  tag: string;
  count: number;
}

interface Props {
  gameCount: number;
  filterStatus: PlayStatus | "all";
  onFilterStatusChange: (s: PlayStatus | "all") => void;
  filterTags: string[];
  onFilterTagsChange: (tags: string[]) => void;
  allTags: TagInfo[];
  onSettings: () => void;
}

const STATUS_OPTIONS: { value: PlayStatus | "all"; label: string; dot?: string }[] = [
  { value: "all", label: "全部游戏" },
  { value: "playing", label: "游玩中", dot: "bg-status-playing" },
  { value: "unplayed", label: "未开始", dot: "bg-status-unplayed" },
  { value: "finished", label: "已通关", dot: "bg-status-finished" },
  { value: "shelved", label: "已搁置", dot: "bg-status-shelved" },
];

export function Sidebar({
  gameCount,
  filterStatus,
  onFilterStatusChange,
  filterTags,
  onFilterTagsChange,
  allTags,
  onSettings,
}: Props) {
  const { theme, toggleTheme } = useTheme();

  const toggleTag = (tag: string) => {
    if (filterTags.includes(tag)) {
      onFilterTagsChange(filterTags.filter((t) => t !== tag));
    } else {
      onFilterTagsChange([...filterTags, tag]);
    }
  };

  return (
    <aside className="w-56 flex-shrink-0 bg-surface-1 border-r border-surface-3/50 flex flex-col h-full overflow-hidden">
      {/* Brand */}
      <div className="px-5 pt-5 pb-4" data-tauri-drag-region>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
            <Gamepad2 className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-text-primary tracking-wide">
              GalManager
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
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onFilterStatusChange(opt.value)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs transition-colors",
                filterStatus === opt.value
                  ? "bg-accent/10 text-accent font-medium"
                  : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
              )}
            >
              {opt.dot ? (
                <span className={cn("w-2 h-2 rounded-full flex-shrink-0", opt.dot)} />
              ) : (
                <span className="w-2 h-2 rounded-full flex-shrink-0 bg-text-muted/30" />
              )}
              {opt.label}
            </button>
          ))}
        </nav>
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

      {/* Bottom actions */}
      <div className="px-3 py-3 border-t border-surface-3/60 space-y-0.5">
        <button
          onClick={onSettings}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          设置
        </button>
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-colors"
        >
          {theme === "dark" ? (
            <>
              <Sun className="w-3.5 h-3.5" />
              切换浅色模式
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5" />
              切换深色模式
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
