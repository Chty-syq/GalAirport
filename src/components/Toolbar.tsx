import {
  Search,
  Grid3X3,
  List,
  ArrowUpDown,
  Plus,
  FolderSearch,
} from "lucide-react";
import type { ViewMode, SortField, SortDirection } from "@/types/game";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";

interface Props {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sortField: SortField;
  onSortFieldChange: (f: SortField) => void;
  sortDirection: SortDirection;
  onSortDirectionChange: (d: SortDirection) => void;
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  onAddGame: () => void;
  onScanGames: () => void;
  gameCount: number;
}

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "created_at", label: "添加时间" },
  { value: "title", label: "标题" },
  { value: "rating", label: "评分" },
  { value: "release_date", label: "发售日期" },
  { value: "total_playtime", label: "游玩时间" },
];

export function Toolbar(props: Props) {
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="space-y-3">
      {/* Top row: search + actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={props.searchQuery}
            onChange={(e) => props.onSearchChange(e.target.value)}
            placeholder="搜索游戏..."
            className="w-full pl-9 pr-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <span className="text-xs text-text-muted">{props.gameCount} 个游戏</span>

        {/* Actions */}
        <button
          onClick={props.onScanGames}
          className="flex items-center gap-1.5 px-3 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
          title="导入本地游戏"
        >
          <FolderSearch className="w-4 h-4" />
          导入游戏
        </button>

        {/* Sort */}
        <div className="relative" ref={sortRef}>
          <button
            onClick={() => setSortOpen(!sortOpen)}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-2 border border-surface-3 hover:bg-surface-3 rounded-lg text-sm text-text-secondary transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {SORT_OPTIONS.find((o) => o.value === props.sortField)?.label}
          </button>
          {sortOpen && (
            <div className="absolute right-0 top-10 w-40 bg-surface-3 border border-surface-4 rounded-lg shadow-xl py-1 z-40">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm transition-colors",
                    props.sortField === opt.value
                      ? "text-accent bg-accent/10"
                      : "text-text-secondary hover:bg-surface-4"
                  )}
                  onClick={() => {
                    if (props.sortField === opt.value) {
                      props.onSortDirectionChange(
                        props.sortDirection === "asc" ? "desc" : "asc"
                      );
                    } else {
                      props.onSortFieldChange(opt.value);
                      props.onSortDirectionChange("desc");
                    }
                    setSortOpen(false);
                  }}
                >
                  {opt.label}
                  {props.sortField === opt.value && (
                    <span className="ml-1 text-xs">
                      {props.sortDirection === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* View mode */}
        <div className="flex bg-surface-2 border border-surface-3 rounded-lg overflow-hidden">
          <button
            onClick={() => props.onViewModeChange("grid")}
            className={cn(
              "p-2 transition-colors",
              props.viewMode === "grid"
                ? "bg-accent/20 text-accent"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => props.onViewModeChange("list")}
            className={cn(
              "p-2 transition-colors",
              props.viewMode === "list"
                ? "bg-accent/20 text-accent"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
