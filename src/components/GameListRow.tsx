import { Play, Star, Clock, Edit, Trash2 } from "lucide-react";
import type { Game } from "@/types/game";
import { statusLabel, statusColor, formatPlaytime, cn, coverSrc } from "@/lib/utils";
import { invoke } from "@tauri-apps/api/core";

interface Props {
  game: Game;
  onEdit: (game: Game) => void;
  onDelete: (id: string) => void;
  onClick: (game: Game) => void;
}

export function GameListRow({ game, onEdit, onDelete, onClick }: Props) {
  const handleLaunch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke("launch_game", { exePath: game.exe_path });
    } catch (err) {
      console.error("Failed to launch:", err);
    }
  };

  const stars = Array.from({ length: 5 }, (_, i) => i < Math.round(game.rating / 2));

  return (
    <div
      className="group flex items-center gap-4 px-4 py-3 bg-surface-1 hover:bg-surface-2 rounded-lg cursor-pointer transition-colors"
      onClick={() => onClick(game)}
    >
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

      {/* Title & developer */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-text-primary truncate">
          {game.title}
        </h3>
        <p className="text-xs text-text-muted truncate">
          {game.developer || "未知开发商"}
        </p>
      </div>

      {/* Status */}
      <span
        className={cn(
          "px-2 py-0.5 rounded-full text-[11px] font-medium text-white/90 flex-shrink-0",
          statusColor(game.play_status)
        )}
      >
        {statusLabel(game.play_status)}
      </span>

      {/* Rating */}
      <div className="flex gap-0.5 flex-shrink-0">
        {stars.map((filled, i) => (
          <Star
            key={i}
            className={cn("w-3 h-3", filled ? "text-yellow-400" : "text-surface-4")}
            fill={filled ? "currentColor" : "none"}
          />
        ))}
      </div>

      {/* Playtime */}
      <span className="text-xs text-text-muted w-24 text-right flex-shrink-0 flex items-center justify-end gap-1">
        <Clock className="w-3 h-3" />
        {game.total_playtime > 0 ? formatPlaytime(game.total_playtime) : "—"}
      </span>

      {/* Actions */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={handleLaunch}
          className="w-8 h-8 rounded-lg bg-accent/20 hover:bg-accent/40 flex items-center justify-center transition-colors"
          title="启动游戏"
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
