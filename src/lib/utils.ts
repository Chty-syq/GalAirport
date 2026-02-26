import type { PlayStatus } from "@/types/game";
import { convertFileSrc } from "@tauri-apps/api/core";

/**
 * Convert a local file path to a URL the WebView can display.
 * Uses Tauri's asset protocol (http://asset.localhost/...) on Windows.
 * Returns empty string for empty/null paths.
 */
export function coverSrc(path: string | null | undefined): string {
  if (!path) return "";
  // If it's already a URL (http/https), return as-is (e.g. VNDB image URL)
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  // Convert local path via Tauri asset protocol
  return convertFileSrc(path);
}

export function formatPlaytime(seconds: number): string {
  if (seconds < 60) return "< 1 分钟";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${minutes} 分钟`;
  return `${hours} 小时 ${minutes} 分钟`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

export function statusLabel(status: PlayStatus): string {
  const map: Record<PlayStatus, string> = {
    unplayed: "未开始",
    playing: "游玩中",
    finished: "已通关",
    shelved: "已搁置",
  };
  return map[status];
}

export function statusColor(status: PlayStatus): string {
  const map: Record<PlayStatus, string> = {
    unplayed: "bg-status-unplayed",
    playing: "bg-status-playing",
    finished: "bg-status-finished",
    shelved: "bg-status-shelved",
  };
  return map[status];
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
