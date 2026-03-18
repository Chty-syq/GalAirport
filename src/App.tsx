import { useState, useEffect, useCallback } from "react";
import { Gamepad2, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { Game, GameFormData, ViewMode } from "@/types/game";
import { useGameLibrary } from "@/hooks/useGameLibrary";
import { useAppearance, CARD_SIZE_OPTIONS } from "@/hooks/useAppearance";
import * as db from "@/lib/database";
import { Sidebar } from "@/components/Sidebar";
import { Toolbar } from "@/components/Toolbar";
import { GameCard } from "@/components/GameCard";
import { GameListRow } from "@/components/GameListRow";
import { GameForm } from "@/components/GameForm";
import { GameDetail } from "@/components/GameDetail";
import { ScanDialog } from "@/components/ScanDialog";
import { VndbMatchDialog } from "@/components/VndbMatchDialog";
import { SettingsDialog } from "@/components/SettingsDialog";
import { CollectionManagerDialog } from "@/components/CollectionDialog";
import { HelpDialog } from "@/components/HelpDialog";
import { WalkthroughDialog } from "@/components/WalkthroughDialog";

function App() {
  const library = useGameLibrary();
  const { appearance } = useAppearance();
  const cardMinPx = CARD_SIZE_OPTIONS.find((o) => o.value === appearance.cardSize)?.px ?? 180;
  const cardGapPx = ({ sm: 8, md: 16, lg: 24 } as Record<string, number>)[appearance.cardGap] ?? 16;
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showForm, setShowForm] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [showScan, setShowScan] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [vndbMatchGame, setVndbMatchGame] = useState<Game | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showCollectionDialog, setShowCollectionDialog] = useState(false);
  const [runningGameId, setRunningGameId] = useState<string | null>(null);
  const [walkthroughGame, setWalkthroughGame] = useState<Game | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // Listen for playtime session ended events from Rust
  useEffect(() => {
    const unlisten = listen<{
      game_id: string;
      start_time: string;
      end_time: string;
      duration: number;
    }>("playtime_session_ended", async (event) => {
      const { game_id, start_time, end_time, duration } = event.payload;
      if (duration > 0) {
        await db.addPlaySession(game_id, start_time, end_time, duration);
        await library.refresh();
      }
      setRunningGameId(null);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const handleLaunchGame = useCallback(async (game: Game) => {
    if (runningGameId) return;
    try {
      await invoke("launch_game", { exePath: game.exe_path, gameId: game.id });
      setRunningGameId(game.id);
      // Auto-launch Magpie if enabled
      const magpieEnabled = await db.getSetting("magpie_enabled");
      if (magpieEnabled === "1") {
        invoke("launch_magpie").catch(() => {});
      }
    } catch (err) {
      console.error("Failed to launch game:", err);
    }
  }, [runningGameId]);

  const handleAddGame = () => {
    setEditingGame(null);
    setShowForm(true);
  };

  const handleEditGame = (game: Game) => {
    setEditingGame(game);
    setShowForm(true);
    setSelectedGame(null);
  };

  const handleSaveGame = async (data: GameFormData) => {
    if (editingGame) {
      await library.updateGame(editingGame.id, data);
    } else {
      await library.addGame(data);
    }
    setShowForm(false);
    setEditingGame(null);
  };

  const handleDeleteGame = (id: string) => {
    setDeleteConfirm(id);
  };

  const confirmDelete = async () => {
    if (deleteConfirm) {
      await library.deleteGame(deleteConfirm);
      setDeleteConfirm(null);
      setSelectedGame(null);
    }
  };

  const handleScanImport = async (games: GameFormData[]) => {
    await library.addGames(games);
    setShowScan(false);
  };

  const handleVndbApply = async (data: Partial<GameFormData>) => {
    if (vndbMatchGame) {
      await library.updateGame(vndbMatchGame.id, data);
      setVndbMatchGame(null);
    }
  };

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => !prev);
    setSelectedIds(new Set());
  };

  const toggleSelectGame = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === library.games.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(library.games.map((g) => g.id)));
    }
  };

  const handleStatusChange = useCallback(async (id: string, status: import("@/types/game").PlayStatus) => {
    await library.updateGame(id, { play_status: status });
    // Keep selectedGame in sync if it's currently open
    setSelectedGame((prev) => prev?.id === id ? { ...prev, play_status: status } : prev);
  }, [library]);

  const confirmBulkDelete = async () => {
    await library.deleteGames(Array.from(selectedIds));
    setBulkDeleteConfirm(false);
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  return (
    <div className="h-screen flex bg-surface-0 overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        gameCount={library.allGames.length}
        filterStatus={library.filterStatus}
        onFilterStatusChange={library.setFilterStatus}
        filterTags={library.filterTags}
        onFilterTagsChange={library.setFilterTags}
        allTags={library.allTags}
        collections={library.collections}
        filterCollection={library.filterCollection}
        onFilterCollection={(id) => {
            library.setFilterCollection(id);
            if (id !== null) library.setShowAllGames(false);
          }}
        showAllGames={library.showAllGames}
        onToggleShowAllGames={() => {
            if (!library.showAllGames) library.setFilterCollection(null);
            library.setShowAllGames((v) => !v);
          }}
        allGames={library.allGames}
        onSettings={() => setShowSettings(true)}
        onHelp={() => setShowHelp(true)}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-6 py-5">
          {/* Toolbar */}
          <Toolbar
            searchQuery={library.searchQuery}
            onSearchChange={library.setSearchQuery}
            sortField={library.sortField}
            onSortFieldChange={library.setSortField}
            sortDirection={library.sortDirection}
            onSortDirectionChange={library.setSortDirection}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onAddGame={handleAddGame}
            onScanGames={() => setShowScan(true)}
            onNewCollection={() => setShowCollectionDialog(true)}
            selectionMode={selectionMode}
            onToggleSelectionMode={toggleSelectionMode}
            gameCount={library.games.length}
          />

          {/* Selection action bar */}
          {selectionMode && (
            <div className="flex items-center gap-4 mt-4 px-4 py-2.5 bg-surface-2 border border-surface-3 rounded-lg">
              {/* Select all checkbox */}
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors"
              >
                <div className={cn(
                  "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                  selectedIds.size > 0 && selectedIds.size === library.games.length
                    ? "bg-accent border-accent"
                    : selectedIds.size > 0
                    ? "bg-accent/40 border-accent"
                    : "border-surface-4"
                )}>
                  {selectedIds.size > 0 && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                全选
              </button>

              <span className="text-xs text-text-muted flex-1">
                {selectedIds.size > 0 ? `已选 ${selectedIds.size} 个` : "点击游戏以选择"}
              </span>

              <button
                onClick={() => setBulkDeleteConfirm(true)}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-status-shelved/10 hover:bg-status-shelved/20 disabled:opacity-40 text-status-shelved text-xs font-medium rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                删除{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
              </button>

              <button
                onClick={toggleSelectionMode}
                className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
              >
                取消
              </button>
            </div>
          )}

          {/* Game library */}
          <div className="mt-5">
            {library.loading ? (
              <div className="flex items-center justify-center py-24">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : library.games.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-text-muted">
                <Gamepad2 className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-lg font-medium mb-1">
                  {library.allGames.length === 0 ? "游戏库为空" : "没有匹配的游戏"}
                </p>
                <p className="text-sm">
                  {library.allGames.length === 0
                    ? "点击「添加」手动添加游戏，或「扫描」自动发现本地游戏"
                    : "尝试调整筛选条件或清除标签过滤"}
                </p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid" style={{ gridTemplateColumns: `repeat(auto-fill,minmax(${cardMinPx}px,1fr))`, gap: `${cardGapPx}px` }}>
                {library.games.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    onEdit={handleEditGame}
                    onDelete={handleDeleteGame}
                    onClick={setSelectedGame}
                    onLaunch={handleLaunchGame}
                    isRunning={runningGameId === game.id}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(game.id)}
                    onToggleSelect={toggleSelectGame}
                    onStatusChange={handleStatusChange}
                    onWalkthrough={setWalkthroughGame}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {library.games.map((game) => (
                  <GameListRow
                    key={game.id}
                    game={game}
                    onEdit={handleEditGame}
                    onDelete={handleDeleteGame}
                    onClick={setSelectedGame}
                    onLaunch={handleLaunchGame}
                    isRunning={runningGameId === game.id}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(game.id)}
                    onToggleSelect={toggleSelectGame}
                    onStatusChange={handleStatusChange}
                    onWalkthrough={setWalkthroughGame}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modals / Panels */}
      {showForm && (
        <GameForm
          game={editingGame}
          onSave={handleSaveGame}
          onClose={() => {
            setShowForm(false);
            setEditingGame(null);
          }}
        />
      )}

      {selectedGame && (
        <GameDetail
          game={selectedGame}
          onClose={() => setSelectedGame(null)}
          onEdit={handleEditGame}
          onLaunch={handleLaunchGame}
          isRunning={runningGameId === selectedGame.id}
          onStatusChange={handleStatusChange}
          onVndbMatch={(game) => {
            setSelectedGame(null);
            setVndbMatchGame(game);
          }}
        />
      )}

      {walkthroughGame && (
        <WalkthroughDialog
          game={walkthroughGame}
          onClose={() => setWalkthroughGame(null)}
        />
      )}

      {showScan && (
        <ScanDialog
          onImport={handleScanImport}
          onClose={() => setShowScan(false)}
        />
      )}

      {vndbMatchGame && (
        <VndbMatchDialog
          game={vndbMatchGame}
          onApply={handleVndbApply}
          onClose={() => setVndbMatchGame(null)}
        />
      )}

      {showSettings && (
        <SettingsDialog onClose={() => setShowSettings(false)} />
      )}

      {showHelp && (
        <HelpDialog onClose={() => setShowHelp(false)} />
      )}

      {showCollectionDialog && (
        <CollectionManagerDialog
          onClose={() => setShowCollectionDialog(false)}
          onChanged={library.refresh}
        />
      )}

      {/* Bulk delete confirmation */}
      {bulkDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 dialog-overlay backdrop-blur-sm"
            onClick={() => setBulkDeleteConfirm(false)}
          />
          <div className="relative bg-surface-1 border border-surface-3 rounded-xl p-6 shadow-2xl max-w-sm w-full">
            <h3 className="text-base font-semibold text-text-primary mb-2">
              确认批量删除
            </h3>
            <p className="text-sm text-text-secondary mb-5">
              确定要从库中移除 <span className="font-medium text-text-primary">{selectedIds.size}</span> 个游戏吗？此操作不会删除本地文件。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setBulkDeleteConfirm(false)}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmBulkDelete}
                className="px-4 py-2 bg-status-shelved hover:bg-status-shelved/80 text-white text-sm font-medium rounded-lg transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 dialog-overlay backdrop-blur-sm"
            onClick={() => setDeleteConfirm(null)}
          />
          <div className="relative bg-surface-1 border border-surface-3 rounded-xl p-6 shadow-2xl max-w-sm w-full">
            <h3 className="text-base font-semibold text-text-primary mb-2">
              确认删除
            </h3>
            <p className="text-sm text-text-secondary mb-5">
              确定要从库中移除这个游戏吗？此操作不会删除本地文件。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-status-shelved hover:bg-status-shelved/80 text-white text-sm font-medium rounded-lg transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
