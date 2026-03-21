import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { Game } from "@/types/game";
import * as db from "@/lib/database";
import { coverSrc, statusLabel } from "@/lib/utils";

type FortuneLevel = "大吉" | "吉" | "小吉" | "末吉" | "凶";

interface FortuneData {
  level: FortuneLevel;
  desc: string;
  gameId: string | null;
  date: string;
}

const FORTUNES: { level: FortuneLevel; weight: number; color: string; bg: string; descs: string[] }[] = [
  {
    level: "大吉", weight: 15, color: "#f59e0b", bg: "#f59e0b22",
    descs: ["今日诸事皆宜，与命中注定的她相遇的好日子", "文字之缘大开，今日推图必有重大突破"],
  },
  {
    level: "吉", weight: 30, color: "#34d399", bg: "#34d39922",
    descs: ["游戏运势上扬，推进剧情必有良好进展", "与角色的羁绊日渐加深，坚持推下去"],
  },
  {
    level: "小吉", weight: 30, color: "#60a5fa", bg: "#60a5fa22",
    descs: ["平稳之日，适合慢慢品味每一段文字", "虽无大起伏，每一步积累都有意义"],
  },
  {
    level: "末吉", weight: 20, color: "#94a3b8", bg: "#94a3b822",
    descs: ["运势平平，不妨趁此机会整理游戏库", "今日不宜冒进，静心享受日常剧情"],
  },
  {
    level: "凶", weight: 5, color: "#f87171", bg: "#f8717122",
    descs: ["今日游戏运势欠佳，小心存档，以防意外", "暂避锋芒，或许是回顾旧作的好时机"],
  },
];

const GAME_TAGLINES: Record<FortuneLevel, string> = {
  大吉: "神谕指引你，今日与此作相遇",
  吉: "缘分牵引，今日不妨一试",
  小吉: "平和之作，适合今日细细品读",
  末吉: "或许就是它了，稳中求进",
  凶: "若实在手痒，勉为其难试试此作",
};

const STATUS_WEIGHT: Record<string, number> = {
  unplayed: 4, playing: 3, finished: 1.5, completed: 0.5,
};

function drawLevel(): { level: FortuneLevel; desc: string } {
  const total = FORTUNES.reduce((a, b) => a + b.weight, 0);
  let rand = Math.random() * total;
  for (const f of FORTUNES) {
    rand -= f.weight;
    if (rand <= 0)
      return { level: f.level, desc: f.descs[Math.floor(Math.random() * f.descs.length)] };
  }
  const f = FORTUNES[1];
  return { level: f.level, desc: f.descs[0] };
}

function recommendGame(games: Game[]): Game | null {
  if (!games.length) return null;
  const total = games.reduce(
    (a, g) => a + (STATUS_WEIGHT[g.play_status] ?? 1) + g.vndb_rating / 100,
    0
  );
  let rand = Math.random() * total;
  for (const g of games) {
    rand -= (STATUS_WEIGHT[g.play_status] ?? 1) + g.vndb_rating / 100;
    if (rand <= 0) return g;
  }
  return games[games.length - 1];
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  games: Game[];
  onClose: () => void;
  onLaunch: (game: Game) => void;
}

export function FortuneDialog({ games, onClose, onLaunch }: Props) {
  const [phase, setPhase] = useState<"idle" | "shaking" | "revealed">("idle");
  const [fortune, setFortune] = useState<FortuneData | null>(null);
  const [recGame, setRecGame] = useState<Game | null>(null);

  useEffect(() => {
    db.getSetting("fortune_today").then((val) => {
      if (!val) return;
      try {
        const data: FortuneData = JSON.parse(val);
        if (data.date === todayStr()) {
          setFortune(data);
          setRecGame(games.find((g) => g.id === data.gameId) ?? null);
          setPhase("revealed");
        }
      } catch { /* ignore */ }
    });
  }, [games]);

  const handleDraw = () => {
    if (phase !== "idle") return;
    setPhase("shaking");
    setTimeout(() => {
      const { level, desc } = drawLevel();
      const rec = recommendGame(games);
      const data: FortuneData = { level, desc, gameId: rec?.id ?? null, date: todayStr() };
      db.setSetting("fortune_today", JSON.stringify(data));
      setFortune(data);
      setRecGame(rec);
      setPhase("revealed");
    }, 700);
  };

  const levelInfo = fortune ? FORTUNES.find((f) => f.level === fortune.level) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-80 rounded-2xl bg-surface-1 border border-surface-3 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-3">
          <span className="text-sm font-semibold text-text-primary">今日运势</span>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col items-center gap-5">
          {/* Idle: draw button */}
          {phase === "idle" && (
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={handleDraw}
                className="group flex flex-col items-center gap-3 focus:outline-none"
              >
                <div className="relative w-20 h-28 flex items-center justify-center">
                  {/* Cylinder body */}
                  <div className="absolute inset-x-2 bottom-0 top-3 rounded-b-full rounded-t-sm bg-gradient-to-b from-amber-700 to-amber-900 border border-amber-600/40 shadow-lg group-hover:shadow-amber-700/30 transition-shadow" />
                  {/* Cylinder top ellipse */}
                  <div className="absolute top-0 inset-x-0 h-6 rounded-full bg-amber-600 border border-amber-500/60 shadow-sm" />
                  {/* Sticks peeking out */}
                  <div className="absolute top-1 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {["-rotate-6", "rotate-0", "rotate-6"].map((r, i) => (
                      <div key={i} className={`w-1 h-8 bg-amber-200/80 rounded-full ${r} origin-bottom shadow-sm`} />
                    ))}
                  </div>
                </div>
                <span className="text-xs text-text-muted group-hover:text-text-secondary transition-colors">
                  摇一摇求签
                </span>
              </button>
              <p className="text-[11px] text-text-muted/60">每日仅可求签一次</p>
            </div>
          )}

          {/* Shaking animation */}
          {phase === "shaking" && (
            <div className="flex flex-col items-center gap-3" style={{ animation: "fortuneShake 0.65s ease-in-out" }}>
              <div className="relative w-20 h-28 flex items-center justify-center">
                <div className="absolute inset-x-2 bottom-0 top-3 rounded-b-full rounded-t-sm bg-gradient-to-b from-amber-700 to-amber-900 border border-amber-600/40 shadow-lg" />
                <div className="absolute top-0 inset-x-0 h-6 rounded-full bg-amber-600 border border-amber-500/60" />
                <div className="absolute top-1 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {["-rotate-6", "rotate-0", "rotate-6"].map((r, i) => (
                    <div key={i} className={`w-1 h-8 bg-amber-200/80 rounded-full ${r} origin-bottom`} />
                  ))}
                </div>
              </div>
              <span className="text-xs text-text-muted animate-pulse">求签中…</span>
            </div>
          )}

          {/* Revealed */}
          {phase === "revealed" && fortune && levelInfo && (
            <div
              className="w-full flex flex-col items-center gap-4"
              style={{ animation: "fortuneFadeIn 0.4s ease-out" }}
            >
              {/* Fortune seal */}
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center border-2 shadow-lg"
                style={{ backgroundColor: levelInfo.bg, borderColor: levelInfo.color + "88" }}
              >
                <span className="text-4xl font-bold" style={{ color: levelInfo.color }}>
                  {fortune.level}
                </span>
              </div>

              {/* Description */}
              <p className="text-xs text-text-secondary text-center leading-relaxed px-1">
                {fortune.desc}
              </p>

              <div className="w-full border-t border-surface-3" />

              {/* Recommended game */}
              {recGame ? (
                <div className="w-full">
                  <p className="text-[10px] text-text-muted mb-2 text-center">
                    {GAME_TAGLINES[fortune.level]}
                  </p>
                  <button
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 transition-colors text-left"
                    onClick={() => { onLaunch(recGame); onClose(); }}
                  >
                    <div className="w-10 h-14 rounded-lg overflow-hidden bg-surface-3 flex-shrink-0">
                      {recGame.cover_path ? (
                        <img src={coverSrc(recGame.cover_path)} alt={recGame.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg font-bold text-text-muted/30">
                          {recGame.title.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{recGame.title}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">{statusLabel(recGame.play_status)}</p>
                    </div>
                  </button>
                </div>
              ) : (
                <p className="text-xs text-text-muted">暂无游戏，先添加一些吧</p>
              )}

              <p className="text-[10px] text-text-muted/50">明日再来</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fortuneShake {
          0%, 100% { transform: rotate(0deg) translateX(0); }
          15%       { transform: rotate(-10deg) translateX(-4px); }
          30%       { transform: rotate(10deg) translateX(4px); }
          45%       { transform: rotate(-7deg) translateX(-3px); }
          60%       { transform: rotate(7deg) translateX(3px); }
          75%       { transform: rotate(-4deg) translateX(-1px); }
          90%       { transform: rotate(4deg) translateX(1px); }
        }
        @keyframes fortuneFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
