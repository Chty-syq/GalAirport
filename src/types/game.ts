export type PlayStatus = "unplayed" | "playing" | "finished" | "shelved";

export interface Game {
  id: string;
  title: string;
  title_original: string;
  vndb_id: string;
  developer: string;
  release_date: string;
  exe_path: string;
  install_path: string;
  save_path: string;
  cover_path: string;
  screenshots: string[];       // local paths to downloaded screenshots
  tags: string[];
  play_status: PlayStatus;
  rating: number;              // user rating 0-10
  vndb_rating: number;         // VNDB rating 0-100
  vndb_votecount: number;      // VNDB vote count
  length_minutes: number;      // average playtime in minutes from VNDB
  notes: string;               // translated description
  engine: string;
  total_playtime: number;      // seconds
  created_at: string;
  updated_at: string;
}

export interface DetectedGame {
  title: string;
  exe_path: string;
  install_path: string;
  engine: string | null;
}

export interface GameFormData {
  title: string;
  title_original: string;
  vndb_id: string;
  developer: string;
  release_date: string;
  exe_path: string;
  install_path: string;
  save_path: string;
  cover_path: string;
  screenshots: string[];
  tags: string[];
  play_status: PlayStatus;
  rating: number;
  vndb_rating: number;
  vndb_votecount: number;
  length_minutes: number;
  notes: string;
  engine: string;
}

export type ViewMode = "grid" | "list";

export type SortField = "title" | "rating" | "created_at" | "release_date" | "total_playtime";
export type SortDirection = "asc" | "desc";