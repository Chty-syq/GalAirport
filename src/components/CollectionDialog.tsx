import { useState, useEffect, useMemo } from "react";
import {
  X, Plus, Trash2, ChevronUp, ChevronDown,
  Search, Loader2, FolderOpen, Check,
} from "lucide-react";
import * as db from "@/lib/database";
import type { Collection, Game } from "@/types/game";
import { cn, coverSrc } from "@/lib/utils";

interface Props {
  onClose: () => void;
  onChanged: () => void;
}

export function CollectionManagerDialog({ onClose, onChanged }: Props) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [colGames, setColGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [gamesLoading, setGamesLoading] = useState(false);

  // Inline create
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState("");

  // Rename
  const [editName, setEditName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState("");

  // Add-games panel
  const [showAdd, setShowAdd] = useState(false);
  const [unassigned, setUnassigned] = useState<Game[]>([]);
  const [addSearch, setAddSearch] = useState("");
  const [addSel, setAddSel] = useState<Set<string>>(new Set());
  const [addingGames, setAddingGames] = useState(false);

  useEffect(() => {
    db.getAllCollections().then((cols) => {
      setCollections(cols);
      setLoading(false);
    });
  }, []);

  const loadColGames = async (id: string) => {
    setGamesLoading(true);
    const games = await db.getCollectionGames(id);
    setColGames(games);
    setGamesLoading(false);
  };

  const selectCollection = (id: string) => {
    if (selectedId === id) return;
    setSelectedId(id);
    setCreating(false);
    setEditName(collections.find((c) => c.id === id)?.name ?? "");
    setRenameError("");
    setShowAdd(false);
    setAddSel(new Set());
    loadColGames(id);
  };

  // ── Create ────────────────────────────────────────────────
  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) { setCreateError("请输入合集名称"); return; }
    try {
      const col = await db.addCollection(trimmed);
      setCollections((prev) => [...prev, col]);
      setNewName("");
      setCreating(false);
      setCreateError("");
      onChanged();
      selectCollection(col.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCreateError(msg.includes("UNIQUE") ? "合集名称已存在" : "创建失败");
    }
  };

  // ── Rename ────────────────────────────────────────────────
  const handleRename = async () => {
    const trimmed = editName.trim();
    if (!trimmed || !selectedId) return;
    if (trimmed === collections.find((c) => c.id === selectedId)?.name) return;
    setRenaming(true);
    try {
      await db.renameCollection(selectedId, trimmed);
      setCollections((prev) =>
        prev.map((c) => (c.id === selectedId ? { ...c, name: trimmed } : c))
      );
      setRenameError("");
      onChanged();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setRenameError(msg.includes("UNIQUE") ? "名称已存在" : "重命名失败");
    }
    setRenaming(false);
  };

  // ── Delete collection ─────────────────────────────────────
  const handleDeleteCollection = async (id: string) => {
    await db.deleteCollection(id);
    setCollections((prev) => prev.filter((c) => c.id !== id));
    if (selectedId === id) { setSelectedId(null); setColGames([]); }
    onChanged();
  };

  // ── Remove game from collection ───────────────────────────
  const handleRemoveGame = async (gameId: string) => {
    await db.setGameCollection(gameId, null);
    setColGames((prev) => prev.filter((g) => g.id !== gameId));
    onChanged();
  };

  // ── Reorder ───────────────────────────────────────────────
  const moveGame = async (index: number, dir: -1 | 1) => {
    const next = [...colGames];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setColGames(next);
    await db.reorderCollectionGames(next.map((g) => g.id));
    onChanged();
  };

  // ── Add games panel ───────────────────────────────────────
  const openAddPanel = async () => {
    const games = await db.getGamesWithoutCollection();
    setUnassigned(games);
    setAddSel(new Set());
    setAddSearch("");
    setShowAdd(true);
  };

  const handleAddGames = async () => {
    if (!selectedId || addSel.size === 0) return;
    setAddingGames(true);
    for (const gid of addSel) {
      await db.setGameCollection(gid, selectedId);
    }
    await loadColGames(selectedId);
    setShowAdd(false);
    setAddSel(new Set());
    onChanged();
    setAddingGames(false);
  };

  const filteredUnassigned = useMemo(() => {
    if (!addSearch.trim()) return unassigned;
    const q = addSearch.toLowerCase();
    return unassigned.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        g.developer.toLowerCase().includes(q)
    );
  }, [unassigned, addSearch]);

  const selectedCol = collections.find((c) => c.id === selectedId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 dialog-overlay backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-2xl bg-surface-1 border border-surface-3 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "82vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-3 shrink-0">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-accent" />
            <h2 className="text-base font-semibold text-text-primary">合集管理</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-surface-3 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-text-secondary" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* ── Left: collection list ─────────────────────── */}
          <div className="w-44 shrink-0 border-r border-surface-3 flex flex-col overflow-hidden">
            {/* Create button / inline form */}
            {creating ? (
              <div className="px-3 py-2.5 border-b border-surface-3 shrink-0">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => { setNewName(e.target.value); setCreateError(""); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") { setCreating(false); setCreateError(""); }
                  }}
                  placeholder="合集名称"
                  autoFocus
                  className="w-full px-2 py-1 bg-surface-2 border border-accent rounded text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none"
                />
                {createError && (
                  <p className="text-[10px] text-status-shelved mt-1">{createError}</p>
                )}
                <div className="flex gap-1 mt-1.5">
                  <button
                    onClick={handleCreate}
                    className="flex-1 py-1 bg-accent text-white text-[10px] rounded hover:bg-accent-hover transition-colors"
                  >
                    确认
                  </button>
                  <button
                    onClick={() => { setCreating(false); setCreateError(""); }}
                    className="flex-1 py-1 bg-surface-3 text-text-secondary text-[10px] rounded hover:bg-surface-4 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setCreating(true); setNewName(""); setCreateError(""); }}
                className="flex items-center gap-2 px-4 py-3 text-xs text-accent hover:bg-surface-2 transition-colors border-b border-surface-3 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                新建合集
              </button>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-4 h-4 text-accent animate-spin" />
                </div>
              ) : collections.length === 0 ? (
                <p className="text-[10px] text-text-muted/50 text-center py-6 px-3">
                  暂无合集
                </p>
              ) : (
                collections.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => selectCollection(col.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-2.5 text-xs transition-colors group",
                      selectedId === col.id
                        ? "bg-accent/10 text-accent"
                        : "text-text-secondary hover:bg-surface-2"
                    )}
                  >
                    <span className="truncate text-left flex-1 min-w-0">{col.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCollection(col.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-text-muted hover:text-status-shelved transition-all shrink-0 ml-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── Right: collection detail ──────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {!selectedId ? (
              <div className="flex-1 flex items-center justify-center text-text-muted/40">
                <div className="text-center">
                  <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">选择或新建合集</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">

                {/* Rename */}
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    合集名称
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => { setEditName(e.target.value); setRenameError(""); }}
                      onKeyDown={(e) => { if (e.key === "Enter") handleRename(); }}
                      className="flex-1 px-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
                    />
                    <button
                      onClick={handleRename}
                      disabled={
                        renaming ||
                        !editName.trim() ||
                        editName.trim() === selectedCol?.name
                      }
                      className="px-3 py-2 bg-surface-3 hover:bg-surface-4 disabled:opacity-40 text-text-secondary text-xs rounded-lg transition-colors"
                    >
                      {renaming ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        "重命名"
                      )}
                    </button>
                  </div>
                  {renameError && (
                    <p className="mt-1 text-[11px] text-status-shelved">{renameError}</p>
                  )}
                </div>

                {/* Games */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-text-secondary">
                      游戏{gamesLoading ? "" : ` (${colGames.length})`}
                    </label>
                    <button
                      onClick={openAddPanel}
                      className="flex items-center gap-1 text-[11px] text-accent hover:text-accent-hover transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      添加游戏
                    </button>
                  </div>

                  {gamesLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-4 h-4 text-accent animate-spin" />
                    </div>
                  ) : colGames.length === 0 ? (
                    <div className="border border-dashed border-surface-3 rounded-lg py-8 text-center">
                      <p className="text-xs text-text-muted/50">
                        暂无游戏，点击「添加游戏」
                      </p>
                    </div>
                  ) : (
                    <div className="border border-surface-3 rounded-lg divide-y divide-surface-3/50 overflow-hidden">
                      {colGames.map((game, idx) => (
                        <div
                          key={game.id}
                          className="flex items-center gap-2.5 px-3 py-2 hover:bg-surface-2 transition-colors"
                        >
                          {/* Up / Down */}
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button
                              onClick={() => moveGame(idx, -1)}
                              disabled={idx === 0}
                              className="w-4 h-4 flex items-center justify-center text-text-muted disabled:opacity-20 hover:text-text-primary transition-colors"
                            >
                              <ChevronUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => moveGame(idx, 1)}
                              disabled={idx === colGames.length - 1}
                              className="w-4 h-4 flex items-center justify-center text-text-muted disabled:opacity-20 hover:text-text-primary transition-colors"
                            >
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Cover */}
                          {game.cover_path ? (
                            <img
                              src={coverSrc(game.cover_path)}
                              alt=""
                              className="w-7 h-9 object-cover rounded shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-9 bg-surface-3 rounded shrink-0" />
                          )}

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-text-primary truncate">
                              {game.title}
                            </p>
                            {game.developer && (
                              <p className="text-[10px] text-text-muted truncate mt-0.5">
                                {game.developer}
                              </p>
                            )}
                          </div>

                          {/* Remove */}
                          <button
                            onClick={() => handleRemoveGame(game.id)}
                            className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-status-shelved transition-colors shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Inline add-games panel */}
                  {showAdd && (
                    <div className="mt-3 border border-surface-3 rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-surface-2 border-b border-surface-3">
                        <span className="text-xs font-medium text-text-secondary">
                          从未分配游戏中添加
                        </span>
                        <button
                          onClick={() => setShowAdd(false)}
                          className="text-text-muted hover:text-text-primary transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="p-2.5 space-y-2">
                        {/* Search */}
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted/60" />
                          <input
                            type="text"
                            value={addSearch}
                            onChange={(e) => setAddSearch(e.target.value)}
                            placeholder="搜索游戏..."
                            className="w-full pl-7 pr-2 py-1.5 bg-surface-2 border border-surface-3 rounded text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent"
                          />
                        </div>

                        {/* Game checkboxes */}
                        <div className="max-h-44 overflow-y-auto space-y-0.5">
                          {filteredUnassigned.length === 0 ? (
                            <p className="text-[10px] text-text-muted text-center py-3">
                              {unassigned.length === 0
                                ? "没有未分配的游戏"
                                : "未找到匹配游戏"}
                            </p>
                          ) : (
                            filteredUnassigned.map((game) => {
                              const sel = addSel.has(game.id);
                              return (
                                <button
                                  key={game.id}
                                  onClick={() =>
                                    setAddSel((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(game.id)) next.delete(game.id);
                                      else next.add(game.id);
                                      return next;
                                    })
                                  }
                                  className={cn(
                                    "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors",
                                    sel ? "bg-accent/10" : "hover:bg-surface-2"
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "w-3.5 h-3.5 rounded border-2 shrink-0 flex items-center justify-center transition-colors",
                                      sel ? "bg-accent border-accent" : "border-surface-3"
                                    )}
                                  >
                                    {sel && <Check className="w-2.5 h-2.5 text-white" />}
                                  </div>
                                  {game.cover_path ? (
                                    <img
                                      src={coverSrc(game.cover_path)}
                                      alt=""
                                      className="w-5 h-7 object-cover rounded shrink-0"
                                    />
                                  ) : (
                                    <div className="w-5 h-7 bg-surface-3 rounded shrink-0" />
                                  )}
                                  <span className="text-xs text-text-primary truncate">
                                    {game.title}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>

                        {addSel.size > 0 && (
                          <div className="flex justify-end pt-1">
                            <button
                              onClick={handleAddGames}
                              disabled={addingGames}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-60 text-white text-xs rounded-lg transition-colors"
                            >
                              {addingGames ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                `添加 ${addSel.size} 个游戏`
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
