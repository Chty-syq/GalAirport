import type React from "react";
import { Play, Star, Clock, Edit, Trash2, Check, GitBranch, Timer } from "lucide-react";
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
  onWalkthrough?: (game: Game) => void;
}

const STATUS_BAR: Record<PlayStatus, string> = {
  unplayed:  "bg-status-unplayed",
  playing:   "bg-status-playing",
  finished:  "bg-status-finished",
  completed: "bg-status-completed",
};

export function GameListRow({
  game, onEdit, onDelete, onClick, onLaunch, isRunning,
  selectionMode, isSelected, onToggleSelect, onStatusChange, onWalkthrough,
}: Props) {
  const handleLaunch = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isRunning) onLaunch(game);
  };

  const userStars = Array.from({ length: 5 }, (_, i) => i < Math.round(game.rating / 2));
  const visibleTags = game.tags.slice(0, 3);
  const subtitle = [game.title_original, game.developer].filter(Boolean).join(" · ");

  return (
    <div
      className={cn(
        "group flex items-stretch rounded-xl cursor-pointer transition-all duration-150 border overflow-hidden",
        selectionMode && isSelected
          ? "bg-accent/8 border-accent/30 shadow-sm"
          : "bg-surface-1 border-surface-3/60 hover:bg-surface-2 hover:border-surface-3 hover:shadow-md hover:shadow-black/5"
      )}
      onClick={() => selectionMode ? onToggleSelect?.(game.id) : onClick(game)}
    >
      {/* Left status accent bar */}
      <div className={cn("w-[3px] flex-shrink-0", STATUS_BAR[game.play_status])} />

      {/* Row content */}
      <div className="flex items-center gap-3 flex-1 px-3 py-2 min-w-0">

        {/* Checkbox */}
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

        {/* Cover thumbnail */}
        <div className="w-11 h-[60px] rounded-md overflow-hidden bg-surface-3 flex-shrink-0 ring-1 ring-black/10 shadow-sm">
          {game.cover_path ? (
            <img src={coverSrc(game.cover_path)} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-base font-bold text-text-muted/20 select-none">
              {game.title.charAt(0)}
            </div>
          )}
        </div>

        {/* Title + subtitle + tags */}
        <div className="flex-1 min-w-0 py-0.5">
          <h3 className="text-[13px] font-semibold text-text-primary truncate leading-tight">
            {game.title}
          </h3>
          {subtitle && (
            <p className="text-[11px] text-text-muted truncate mt-0.5 leading-tight">{subtitle}</p>
          )}
          <div className="flex items-center gap-1 mt-1.5">
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-1.5 py-[1px] bg-accent/10 text-accent text-[10px] font-medium rounded border border-accent/15 leading-none flex-shrink-0"
              >
                {tag}
              </span>
            ))}
            {game.tags.length > 3 && (
              <span className="text-[10px] text-text-muted/40">+{game.tags.length - 3}</span>
            )}
          </div>
        </div>

        {/* Ratings column */}
        <div className="w-24 flex-shrink-0 flex flex-col items-end justify-center gap-1">
          {/* VNDB rating */}
          {game.vndb_rating > 0 && (
            <span className="flex items-center gap-1 text-[12px] font-bold text-amber-400">
              <Star className="w-3 h-3" fill="currentColor" />
              {(game.vndb_rating / 10).toFixed(1)}
            </span>
          )}
          {/* User star rating */}
          {game.rating > 0 && (
            <span className="flex items-center gap-0.5">
              {userStars.map((filled, i) => (
                <Star
                  key={i}
                  className={cn("w-2.5 h-2.5", filled ? "text-yellow-400" : "text-surface-4")}
                  fill={filled ? "currentColor" : "none"}
                />
              ))}
            </span>
          )}
          {/* VNDB length hint when no rating */}
          {game.vndb_rating === 0 && game.rating === 0 && game.length_minutes > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-text-muted/50">
              <Timer className="w-2.5 h-2.5" />
              {game.length_minutes >= 60 ? `${Math.round(game.length_minutes / 60)}h` : `${game.length_minutes}m`}
            </span>
          )}
        </div>

        {/* Status */}
        <div className="w-[92px] flex-shrink-0 flex justify-end" onClick={(e) => e.stopPropagation()}>
          {isRunning ? (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium text-white bg-green-600/90">
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

        {/* Playtime */}
        <div className="w-24 flex-shrink-0 flex items-center justify-end gap-1">
          <Clock className="w-3 h-3 text-text-muted/40 flex-shrink-0" />
          <span className={cn(
            "text-xs tabular-nums",
            game.total_playtime > 0 ? "text-text-secondary" : "text-text-muted/35"
          )}>
            {game.total_playtime > 0 ? formatPlaytime(game.total_playtime) : "—"}
          </span>
        </div>

        {/* Actions */}
        <div className={cn(
          "flex gap-0.5 flex-shrink-0 transition-opacity",
          selectionMode ? "invisible" : "opacity-0 group-hover:opacity-100"
        )}>
          <button
            onClick={handleLaunch}
            disabled={isRunning}
            className="w-7 h-7 rounded-md bg-accent/15 hover:bg-accent/30 disabled:opacity-40 flex items-center justify-center transition-colors"
            title={isRunning ? "游戏运行中" : "启动游戏"}
          >
            <Play className="w-3.5 h-3.5 text-accent" fill="currentColor" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onWalkthrough?.(game); }}
            className="w-7 h-7 rounded-md hover:bg-surface-3 flex items-center justify-center transition-colors"
            title="攻略图"
          >
            <GitBranch className="w-3.5 h-3.5 text-text-muted" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(game); }}
            className="w-7 h-7 rounded-md hover:bg-surface-3 flex items-center justify-center transition-colors"
            title="编辑"
          >
            <Edit className="w-3.5 h-3.5 text-text-muted" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(game.id); }}
            className="w-7 h-7 rounded-md hover:bg-status-shelved/15 flex items-center justify-center transition-colors group/del"
            title="删除"
          >
            <Trash2 className="w-3.5 h-3.5 text-text-muted group-hover/del:text-status-shelved transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
}
