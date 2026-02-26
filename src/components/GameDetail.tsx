import { useState } from "react";
import { X, Play, FolderOpen, Clock, Star, Tag, Globe, Edit } from "lucide-react";
import type { Game } from "@/types/game";
import { statusLabel, statusColor, formatPlaytime, cn, coverSrc } from "@/lib/utils";
import { invoke } from "@tauri-apps/api/core";

interface Props {
  game: Game;
  onClose: () => void;
  onEdit: (game: Game) => void;
  onVndbMatch?: (game: Game) => void;
}

export function GameDetail({ game, onClose, onEdit, onVndbMatch }: Props) {
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  const handleLaunch = async () => {
    try {
      await invoke("launch_game", { exePath: game.exe_path });
    } catch (err) {
      console.error("Failed to launch:", err);
    }
  };

  const openFolder = async () => {
    await invoke("open_folder", { path: game.install_path });
  };

  const vndbScore = game.vndb_rating > 0 ? (game.vndb_rating / 10).toFixed(1) : null;
  const vndbUrl = game.vndb_id ? `https://vndb.org/${game.vndb_id}` : null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 dialog-overlay backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-lg bg-surface-1 border-l border-surface-3 overflow-y-auto animate-slide-in">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-surface-3 hover:bg-surface-4 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4 text-text-secondary" />
        </button>

        {/* Cover */}
        <div className="relative aspect-video bg-surface-2">
          {game.cover_path ? (
            <img
              src={coverSrc(game.cover_path)}
              alt={game.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-2 to-surface-3">
              <span className="text-6xl font-bold text-text-muted/20">
                {game.title.charAt(0)}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface-1 via-transparent to-transparent" />
        </div>

        {/* Content */}
        <div className="px-6 pb-8 -mt-8 relative">
          {/* Status */}
          <span
            className={cn(
              "inline-block px-3 py-1 rounded-full text-xs font-medium text-white/90 mb-3",
              statusColor(game.play_status)
            )}
          >
            {statusLabel(game.play_status)}
          </span>

          <h1 className="text-2xl font-bold text-text-primary leading-tight">
            {game.title}
          </h1>
          {game.title_original && game.title_original !== game.title && (
            <p className="text-sm text-text-muted mt-1">{game.title_original}</p>
          )}

          {/* Meta */}
          <div className="mt-4 space-y-2 text-sm">
            {game.developer && (
              <div className="flex justify-between">
                <span className="text-text-muted">开发商</span>
                <span className="text-text-primary">{game.developer}</span>
              </div>
            )}
            {game.release_date && (
              <div className="flex justify-between">
                <span className="text-text-muted">发售日</span>
                <span className="text-text-primary">{game.release_date}</span>
              </div>
            )}
            {game.engine && (
              <div className="flex justify-between">
                <span className="text-text-muted">引擎</span>
                <span className="text-text-primary">{game.engine}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-text-muted">游玩时间</span>
              <span className="text-text-primary flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {game.total_playtime > 0
                  ? formatPlaytime(game.total_playtime)
                  : "暂无记录"}
              </span>
            </div>
          </div>

          {/* VNDB Rating */}
          <div className="mt-4">
            <span className="text-xs text-text-muted block mb-1">VNDB 评分</span>
            {vndbScore ? (
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-400" fill="currentColor" />
                <span className="text-xl font-bold text-text-primary">{vndbScore}</span>
                <span className="text-xs text-text-muted">/ 10</span>
                {game.vndb_id && (
                  <span className="text-[10px] text-text-muted ml-auto">via VNDB</span>
                )}
              </div>
            ) : (
              <span className="text-sm text-text-muted">暂无评分</span>
            )}
          </div>
          
          {/* VNDB Link */}
          {vndbUrl && (
            <div className="mt-3">
              <button
                onClick={() => invoke("open_url", { url: vndbUrl })}
                className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover transition-colors"
              >
                <Globe className="w-3.5 h-3.5" />
                {vndbUrl}
              </button>
            </div>
          )}

          {/* Tags */}
          {game.tags.length > 0 && (
            <div className="mt-4">
              <span className="text-xs text-text-muted block mb-2">
                <Tag className="w-3 h-3 inline mr-1" />
                标签
              </span>
              <div className="flex flex-wrap gap-1.5">
                {game.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-0.5 bg-accent/10 text-accent text-xs rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {game.notes && (
            <div className="mt-4">
              <span className="text-xs text-text-muted block mb-1">简介</span>
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                {game.notes}
              </p>
            </div>
          )}
          
          {/* Screenshots */}
          {game.screenshots && game.screenshots.length > 0 && (
            <div className="mt-4">
              <span className="text-xs text-text-muted block mb-2">截图</span>
              <div className="grid grid-cols-2 gap-2">
                {game.screenshots.map((ss, i) => (
                  <div
                    key={i}
                    className="rounded-lg overflow-hidden bg-surface-2 aspect-video cursor-pointer"
                    onClick={() => setLightboxImg(coverSrc(ss))}
                  >
                    <img
                      src={coverSrc(ss)}
                      alt={`截图 ${i + 1}`}
                      className="w-full h-full object-cover hover:opacity-80 transition-opacity"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Paths */}
          <div className="mt-6 p-3 bg-surface-2 rounded-lg text-xs space-y-1">
            <div className="text-text-muted">
              <span className="font-medium">可执行文件:</span>{" "}
              <span className="text-text-secondary break-all">{game.exe_path}</span>
            </div>
            <div className="text-text-muted">
              <span className="font-medium">安装目录:</span>{" "}
              <span className="text-text-secondary break-all">
                {game.install_path}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-6 flex gap-3">
            {onVndbMatch && (
              <button
                onClick={() => onVndbMatch(game)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium text-sm transition-colors"
              >
                <Globe className="w-4 h-4" /> VNDB 自动匹配
              </button>
            )}
          </div>

          <div className="mt-3 flex gap-3">
            <button
              onClick={openFolder}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-surface-3 hover:bg-surface-4 text-text-primary rounded-lg text-sm transition-colors"
            >
              <FolderOpen className="w-4 h-4" /> 打开目录
            </button>
            <button
              onClick={handleLaunch}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-surface-3 hover:bg-surface-4 text-text-primary rounded-lg text-sm transition-colors"
            >
              <Play className="w-4 h-4" fill="currentColor" /> 启动游戏
            </button>
            <button
              onClick={() => onEdit(game)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-surface-3 hover:bg-surface-4 text-text-primary rounded-lg text-sm transition-colors"
            >
              <Edit className="w-4 h-4" /> 编辑信息
            </button>
          </div>
        </div>
      </div>

      {/* Screenshot Lightbox */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-pointer"
          onClick={() => setLightboxImg(null)}
        >
          <img
            src={lightboxImg}
            alt="截图放大"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxImg(null)}
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      )}

    </div>
  );
}
