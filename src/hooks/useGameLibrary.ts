import { useState, useEffect, useCallback, useMemo } from "react";
import type { Collection, Game, GameFormData, PlayStatus, SortField, SortDirection } from "@/types/game";
import * as db from "@/lib/database";

export function useGameLibrary() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<PlayStatus | "all">("all");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterCollection, setFilterCollection] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [collections, setCollections] = useState<Collection[]>([]);

  const loadGames = useCallback(async () => {
    setLoading(true);
    try {
      const [allGames, allCollections] = await Promise.all([
        searchQuery ? db.searchGames(searchQuery) : db.getAllGames(),
        db.getAllCollections(),
      ]);
      setGames(allGames);
      setCollections(allCollections);
    } catch (err) {
      console.error("Failed to load games:", err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  const addGame = useCallback(
    async (data: GameFormData) => {
      await db.addGame(data);
      await loadGames();
    },
    [loadGames]
  );

  const addGames = useCallback(
    async (dataList: GameFormData[]) => {
      for (const data of dataList) {
        await db.addGame(data);
      }
      await loadGames();
    },
    [loadGames]
  );

  const updateGame = useCallback(
    async (id: string, data: Partial<GameFormData>) => {
      await db.updateGame(id, data);
      await loadGames();
    },
    [loadGames]
  );

  const deleteGame = useCallback(
    async (id: string) => {
      await db.deleteGame(id);
      await loadGames();
    },
    [loadGames]
  );

  const addCollection = useCallback(
    async (name: string): Promise<Collection> => {
      const col = await db.addCollection(name);
      await loadGames();
      return col;
    },
    [loadGames]
  );

  const deleteCollection = useCallback(
    async (id: string) => {
      await db.deleteCollection(id);
      if (filterCollection === id) setFilterCollection(null);
      await loadGames();
    },
    [loadGames, filterCollection]
  );

  const setGameCollection = useCallback(
    async (gameId: string, collectionId: string | null) => {
      await db.setGameCollection(gameId, collectionId);
      await loadGames();
    },
    [loadGames]
  );

  // Collect all tags across the library with counts
  const allTags = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of games) {
      for (const t of g.tags) {
        map.set(t, (map.get(t) || 0) + 1);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1]) // sort by count desc
      .map(([tag, count]) => ({ tag, count }));
  }, [games]);

  // Filtered & sorted games
  const filteredGames = games
    // Collection filter: no collection selected → only unassigned; collection selected → that collection only
    .filter((g) =>
      filterCollection === null
        ? g.collection_id === null
        : g.collection_id === filterCollection
    )
    .filter((g) => filterStatus === "all" || g.play_status === filterStatus)
    .filter(
      (g) =>
        filterTags.length === 0 ||
        filterTags.every((t) => g.tags.includes(t))
    )
    .sort((a, b) => {
      // When a collection is active, honour user-defined order
      if (filterCollection !== null) {
        return a.collection_order - b.collection_order;
      }
      let cmp = 0;
      switch (sortField) {
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "rating":
          cmp = a.vndb_rating - b.vndb_rating;
          break;
        case "created_at":
          cmp = a.created_at.localeCompare(b.created_at);
          break;
        case "release_date":
          cmp = (a.release_date || "").localeCompare(b.release_date || "");
          break;
        case "total_playtime":
          cmp = a.total_playtime - b.total_playtime;
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });

  return {
    games: filteredGames,
    allGames: games,
    allTags,
    loading,
    searchQuery,
    setSearchQuery,
    filterStatus,
    setFilterStatus,
    filterTags,
    setFilterTags,
    filterCollection,
    setFilterCollection,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    collections,
    addGame,
    addGames,
    updateGame,
    deleteGame,
    addCollection,
    deleteCollection,
    setGameCollection,
    refresh: loadGames,
  };
}
