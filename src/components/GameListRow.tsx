import { Play, Star, Clock, Edit, Trash2, Check, Globe } from "lucide-react";
import type { Game, PlayStatus } from "@/types/game";
import { formatPlaytime, cn, coverSrc } from "@/lib/utils";
import { StatusDropdown } from "@/components/StatusDropdown";

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

export function GameListRow({ game, onEdit, onDelete, onClick, onLaunch, isRunning, selectionMode, isSelected, onToggleSelect, onStatusChange }: Props) {
  const handleLaunch = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isRunning) onLaunch(game);
  };

  const userStars = Array.from({ length: 5 }, (_, i) => i < Math.round(game.rating / 2));
  const visibleTags = game.tags.slice(0, 3);

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-4 py-2.5 rounded-lg cursor-pointer transition-colors",
        selectionMode && isSelected ? "bg-accent/8 hover:bg-accent/12" : "bg-surface-1 hover:bg-surface-2"
      )}
      onClick={() => selectionMode ? onToggleSelect?.(game.id) : onClick(game)}
    >
      {/* Checkbox (selection mode) */}
      {selectionMode && (
        <div
          className={cn(
            "w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors",
            isSelected ? "bg-accent border-accent" : "border-surface-3"
          )}
          onClick={(e) => { e.stopPropagation(); onToggleSelect?.(game.id); }}
        >
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </div>
      )}

      {/* Mini cover */}
      <div className="w-10 h-14 rounded-md overflow-hidden bg-surface-3 flex-shrink-0">
        {game.cover_path ? (
          <img
            src={coverSrc(game.cover_path)}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs font-bold text-text-muted/30">
            {game.title.charAt(0)}
          </div>
        )}
      </div>

      {/* Title, developer & tags */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-text-primary truncate leading-snug">
          {game.title}
        </h3>
        <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
          <span className="text-xs text-text-muted truncate shrink-0 max-w-[140px]">
            {game.developer || "未知开发商"}
          </span>
          {visibleTags.length > 0 && (
            <span className="text-text-muted/30 text-xs flex-shrink-0">·</span>
          )}
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-1.5 py-px bg-accent/10 text-accent text-[10px] font-medium rounded-full border border-accent/15 leading-none flex-shrink-0"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* VNDB rating */}
      <div className="w-16 flex-shrink-0 flex items-center justify-end">
        {game.vndb_rating > 0 ? (
          <span className="flex items-center gap-1 text-xs font-medium text-text-secondary">
            <Globe className="w-3 h-3 text-text-muted" />
            {(game.vndb_rating / 10).toFixed(2)}
          </span>
        ) : null}
      </div>

      {/* User rating (only when rated) */}
      <div className="w-20 flex-shrink-0 flex items-center justify-end gap-0.5">
        {game.rating > 0
          ? userStars.map((filled, i) => (
              <Star
                key={i}
                className={cn("w-3 h-3", filled ? "text-yellow-400" : "text-surface-4")}
                fill={filled ? "currentColor" : "none"}
              />
            ))
          : null}
      </div>

      {/* Status */}
      {isRunning ? (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium text-white bg-green-600/90 flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          运行中
        </span>
      ) : (
        <span className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <StatusDropdown
            status={game.play_status}
            onChange={(s) => onStatusChange?.(game.id, s)}
            disabled={selectionMode}
          />
        </span>
      )}

      {/* Playtime */}
      <span className="text-xs text-text-muted w-20 text-right flex-shrink-0 flex items-center justify-end gap-1">
        <Clock className="w-3 h-3" />
        {game.total_playtime > 0 ? formatPlaytime(game.total_playtime) : "—"}
      </span>

      {/* Actions */}
      <div className={cn("flex gap-1 transition-opacity flex-shrink-0", selectionMode ? "invisible" : "opacity-0 group-hover:opacity-100")}>
        <button
          onClick={handleLaunch}
          disabled={isRunning}
          className="w-8 h-8 rounded-lg bg-accent/20 hover:bg-accent/40 disabled:opacity-40 flex items-center justify-center transition-colors"
          title={isRunning ? "游戏运行中" : "启动游戏"}
        >
          <Play className="w-3.5 h-3.5 text-accent" fill="currentColor" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(game);
          }}
          className="w-8 h-8 rounded-lg hover:bg-surface-3 flex items-center justify-center transition-colors"
          title="编辑"
        >
          <Edit className="w-3.5 h-3.5 text-text-secondary" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(game.id);
          }}
          className="w-8 h-8 rounded-lg hover:bg-status-shelved/20 flex items-center justify-center transition-colors"
          title="删除"
        >
          <Trash2 className="w-3.5 h-3.5 text-text-secondary" />
        </button>
      </div>
    </div>
  );
}
