import { useEffect, useMemo, useState } from "react";
import { X, Gamepad2, Clock, Star, Trophy } from "lucide-react";
import type { Game } from "@/types/game";
import { formatPlaytime, statusLabel, statusColor } from "@/lib/utils";
import * as db from "@/lib/database";

interface Props {
  games: Game[];
  onClose: () => void;
}

// 生成最近 N 个月的 YYYY-MM 列表（倒序 → 正序）
function lastNMonths(n: number): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return result;
}

function monthLabel(ym: string) {
  const [, m] = ym.split("-");
  return `${parseInt(m)}月`;
}

// 简洁数字格式
function fmtNum(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return String(n);
}

export function StatsDialog({ games, onClose }: Props) {
  const [monthlyRaw, setMonthlyRaw] = useState<{ month: string; seconds: number }[]>([]);

  useEffect(() => {
    db.getMonthlyPlaytime().then(setMonthlyRaw);
  }, []);

  // ── 基础统计 ──
  const total = games.length;
  const statusCounts = useMemo(() => {
    const m = { unplayed: 0, playing: 0, finished: 0, completed: 0 };
    for (const g of games) m[g.play_status] = (m[g.play_status] ?? 0) + 1;
    return m;
  }, [games]);

  const totalPlaytime = useMemo(
    () => games.reduce((s, g) => s + g.total_playtime, 0),
    [games]
  );

  const ratedGames = useMemo(() => games.filter((g) => g.rating > 0), [games]);
  const avgRating = ratedGames.length
    ? ratedGames.reduce((s, g) => s + g.rating, 0) / ratedGames.length
    : 0;

  const doneCount = statusCounts.finished + statusCounts.completed;

  // ── Top 游玩时长 ──
  const topByPlaytime = useMemo(
    () => [...games].sort((a, b) => b.total_playtime - a.total_playtime).slice(0, 5),
    [games]
  );
  const maxPlaytime = topByPlaytime[0]?.total_playtime ?? 1;

  // ── 标签频率 ──
  const topTags = useMemo(() => {
    const freq: Record<string, number> = {};
    for (const g of games) for (const t of g.tags) freq[t] = (freq[t] ?? 0) + 1;
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [games]);

  // ── 月度数据 (近6月) ──
  const months = lastNMonths(6);
  const monthMap = Object.fromEntries(monthlyRaw.map((r) => [r.month, r.seconds]));
  const monthValues = months.map((m) => ({ label: monthLabel(m), seconds: monthMap[m] ?? 0 }));
  const maxMonthSec = Math.max(...monthValues.map((m) => m.seconds), 1);

  // 状态分布颜色（用 tailwind class → hex 映射，避免动态 class 问题）
  const STATUS_HEX: Record<string, string> = {
    unplayed: "#64748b",
    playing:  "#3b82f6",
    finished: "#10b981",
    completed: "#f59e0b",
  };
  const statuses = ["unplayed", "playing", "finished", "completed"] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-[720px] max-h-[85vh] flex flex-col rounded-2xl bg-surface-1 border border-surface-3 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-3 flex-shrink-0">
          <span className="text-sm font-semibold text-text-primary">数据看板</span>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">

          {/* ── 概览卡片 ── */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { icon: <Gamepad2 className="w-4 h-4" />, label: "游戏总数", value: fmtNum(total), sub: `${doneCount} 款已通关` },
              { icon: <Clock className="w-4 h-4" />, label: "总游玩时长", value: formatPlaytime(totalPlaytime), sub: `${games.filter(g => g.total_playtime > 0).length} 款有记录` },
              { icon: <Star className="w-4 h-4" />, label: "平均评分", value: avgRating > 0 ? avgRating.toFixed(1) : "—", sub: `${ratedGames.length} 款已评分` },
              { icon: <Trophy className="w-4 h-4" />, label: "全线通关", value: fmtNum(statusCounts.completed), sub: `完成率 ${total > 0 ? Math.round(statusCounts.completed / total * 100) : 0}%` },
            ].map(({ icon, label, value, sub }) => (
              <div key={label} className="bg-surface-2 rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-text-muted">
                  {icon}
                  <span className="text-xs">{label}</span>
                </div>
                <span className="text-2xl font-bold text-text-primary">{value}</span>
                <span className="text-[11px] text-text-muted">{sub}</span>
              </div>
            ))}
          </div>

          {/* ── 状态分布 ── */}
          <div className="bg-surface-2 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-medium text-text-secondary">游戏状态分布</h3>
            {/* 分段条 */}
            <div className="flex h-3 rounded-full overflow-hidden gap-px">
              {statuses.map((s) => {
                const pct = total > 0 ? (statusCounts[s] / total) * 100 : 0;
                return pct > 0 ? (
                  <div
                    key={s}
                    title={`${statusLabel(s)}: ${statusCounts[s]}`}
                    style={{ width: `${pct}%`, backgroundColor: STATUS_HEX[s] }}
                  />
                ) : null;
              })}
            </div>
            {/* 图例 */}
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {statuses.map((s) => (
                <div key={s} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_HEX[s] }} />
                  <span className="text-[11px] text-text-secondary">{statusLabel(s)}</span>
                  <span className="text-[11px] text-text-muted">{statusCounts[s]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* ── 游玩时长 Top 5 ── */}
            <div className="bg-surface-2 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-medium text-text-secondary">游玩时长 Top 5</h3>
              {topByPlaytime.filter(g => g.total_playtime > 0).length === 0 ? (
                <p className="text-xs text-text-muted py-4 text-center">暂无游玩记录</p>
              ) : (
                <div className="space-y-2.5">
                  {topByPlaytime.filter(g => g.total_playtime > 0).map((g) => (
                    <div key={g.id} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-text-primary truncate max-w-[60%]">{g.title}</span>
                        <span className="text-[11px] text-text-muted flex-shrink-0">{formatPlaytime(g.total_playtime)}</span>
                      </div>
                      <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent transition-all"
                          style={{ width: `${(g.total_playtime / maxPlaytime) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── 月度游玩 ── */}
            <div className="bg-surface-2 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-medium text-text-secondary">近 6 个月游玩时长</h3>
              <div className="flex items-end gap-2 h-28">
                {monthValues.map(({ label, seconds }) => (
                  <div key={label} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-text-muted">
                      {seconds > 0 ? formatPlaytime(seconds) : ""}
                    </span>
                    <div className="w-full flex items-end" style={{ height: 72 }}>
                      <div
                        className="w-full rounded-t-sm bg-accent/70 hover:bg-accent transition-colors"
                        style={{ height: `${(seconds / maxMonthSec) * 100}%`, minHeight: seconds > 0 ? 3 : 0 }}
                      />
                    </div>
                    <span className="text-[10px] text-text-muted">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── 热门标签 ── */}
          {topTags.length > 0 && (
            <div className="bg-surface-2 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-medium text-text-secondary">热门标签</h3>
              <div className="flex flex-wrap gap-2">
                {topTags.map(([tag, count]) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-3 text-xs text-text-secondary"
                  >
                    {tag}
                    <span className="text-[10px] text-text-muted">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
