import { Play, Star, Clock, MoreVertical, Trash2, Edit, FolderOpen, Save, Check } from "lucide-react";
import type { Game, PlayStatus } from "@/types/game";
import { formatPlaytime, cn, coverSrc } from "@/lib/utils";
import { StatusDropdown } from "@/components/StatusDropdown";
import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "@/components/Toast";

interface Props {
  game: Game;
  onEdit: (game: Game) => void;
  onDelete: (id: string) => void;
  onClick: (game: Game) => void;
  onLaunch: (game: Game) => void;
  isRunning: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onStatusChange?: (id: string, status: PlayStatus) => void;
}

export function GameCard({ game, onEdit, onDelete, onClick, onLaunch, isRunning, selectionMode, isSelected, onToggleSelect, onStatusChange }: Props) {
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLaunch = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning) return;
    if (!game.exe_path) {
      toast("error", `「${game.title}」未设置可执行文件路径`);
      return;
    }
    onLaunch(game);
  };

  return (
    <div
      className={cn(
        "group relative bg-surface-2 rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:bg-surface-3 hover:shadow-lg hover:shadow-accent/5 hover:-translate-y-0.5",
        selectionMode && isSelected && "ring-2 ring-accent ring-offset-2 ring-offset-surface-0"
      )}
      onClick={() => selectionMode ? onToggleSelect?.(game.id) : onClick(game)}
    >
      {/* Cover image */}
      <div className="relative aspect-[3/4] bg-surface-3 overflow-hidden">
        {game.cover_path ? (
          <img
            src={coverSrc(game.cover_path)}
            alt={game.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-3 to-surface-4">
            <span className="text-4xl font-bold text-text-muted/30">
              {game.title.charAt(0)}
            </span>
          </div>
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Play button overlay */}
        {!isRunning && (
          <button
            onClick={handleLaunch}
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          >
            <div className="w-14 h-14 rounded-full bg-accent/90 flex items-center justify-center shadow-lg backdrop-blur-sm hover:bg-accent transition-colors">
              <Play className="w-6 h-6 text-white ml-0.5" fill="currentColor" />
            </div>
          </button>
        )}

        {/* Selection checkbox */}
        {selectionMode && (
          <div
            className="absolute top-2 left-2 z-10"
            onClick={(e) => { e.stopPropagation(); onToggleSelect?.(game.id); }}
          >
            <div className={cn(
              "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shadow-sm",
              isSelected
                ? "bg-accent border-accent"
                : "bg-black/40 border-white/60 backdrop-blur-sm"
            )}>
              {isSelected && <Check className="w-3 h-3 text-white" />}
            </div>
          </div>
        )}

        {/* Status badge */}
        <div className={cn("absolute flex flex-col gap-1", selectionMode ? "top-2.5 left-8" : "top-2.5 left-2.5")}>
          {isRunning ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium text-white bg-green-600/90 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              运行中
            </span>
          ) : (
            <StatusDropdown
              status={game.play_status}
              onChange={(s) => onStatusChange?.(game.id, s)}
              disabled={selectionMode}
            />
          )}
        </div>

        {/* Context menu */}
        {!selectionMode && <div className="absolute top-2 right-2" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60"
          >
            <MoreVertical className="w-3.5 h-3.5 text-white" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 w-36 bg-surface-3 border border-surface-4 rounded-lg shadow-xl py-1 z-50">
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-4 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(game);
                  setMenuOpen(false);
                }}
              >
                <Edit className="w-3.5 h-3.5" /> 编辑
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-4 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  invoke("open_folder", { path: game.install_path });
                  setMenuOpen(false);
                }}
              >
                <FolderOpen className="w-3.5 h-3.5" /> 打开目录
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-4 transition-colors"
                onClick={async (e) => {
                  e.stopPropagation();
                  if (game.save_path) {
                    invoke("open_folder", { path: game.save_path });
                  } else {
                    try {
                      const dirs = await invoke<string[]>("find_save_directories", { installPath: game.install_path });
                      invoke("open_folder", { path: dirs.length > 0 ? dirs[0] : game.install_path });
                    } catch {
                      invoke("open_folder", { path: game.install_path });
                    }
                  }
                  setMenuOpen(false);
                }}
              >
                <Save className="w-3.5 h-3.5" /> 打开存档
              </button>
              <hr className="border-surface-4 my-1" />
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-status-shelved hover:bg-surface-4 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(game.id);
                  setMenuOpen(false);
                }}
              >
                <Trash2 className="w-3.5 h-3.5" /> 删除
              </button>
            </div>
          )}
        </div>}
      </div>

      {/* Info section */}
      <div className="p-3">
        <h3 className="text-sm font-medium text-text-primary truncate leading-tight">
          {game.title}
        </h3>
        <p className="text-[10px] text-text-muted mt-0.5 truncate leading-tight">
          {game.tags.length > 0 ? game.tags.join(" / ") : <span className="opacity-40">暂无标签</span>}
        </p>
        <div className="flex items-center justify-between mt-2">
          {game.vndb_rating > 0 ? (
            <div className="flex items-center gap-1">
              <span className="text-accent flex items-center gap-1">
                <Star className="w-3 h-3" fill="currentColor" />
                <span className="text-xs font-medium text-text-primary">
                  {(game.vndb_rating / 10).toFixed(2)}
                </span>
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-text-muted">暂无评分</span>
          )}

          {game.total_playtime > 0 && (
            <span className="text-[10px] text-text-muted flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {formatPlaytime(game.total_playtime)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}