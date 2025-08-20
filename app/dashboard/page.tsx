// File: src/app/dashboard/page.tsx
"use client";

import Navbar from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { usePlan } from "@/lib/context/PlanContext";
import { useBoards } from "@/lib/hooks/useBoards";
import { Board, Column, Task } from "@/lib/supabase/models";
import { useUser } from "@clerk/nextjs";
import {
  Filter,
  Grid3X3,
  List,
  Loader2,
  Pencil,
  Plus,
  Rocket,
  Search,
  Trello,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type Filters = {
  search: string;
  dateRange: { start: string | null; end: string | null };
  taskCount: { min: number | null; max: number | null };
};

const initialFilters: Filters = {
  search: "",
  dateRange: { start: null, end: null },
  taskCount: { min: null, max: null },
};

type UndoBoardState = null | {
  snapshot: {
    board: Board;
    columns: Column[];
    tasks: Task[];
  };
  timeoutId: number | null;
  intervalId: number | null;
  remaining: number;
};

const UNDO_SECONDS = 5;

type BoardWithCount = Board & { taskCount: number };

const COLOR_OPTIONS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
  "bg-red-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-gray-500",
  "bg-orange-500",
  "bg-teal-500",
  "bg-cyan-500",
  "bg-emerald-500",
];

export default function DashbordPage() {
  const { user } = useUser();
  const {
    createBoard,
    updateBoard, 
    boards,
    loading,
    error,
    boardCounts,
    deleteBoard,
    restoreBoard,
  } = useBoards();
  const { isFreeUser } = usePlan();
  const router = useRouter();

  // UI state
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(initialFilters);

  // Create Board dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [newBoardDesc, setNewBoardDesc] = useState("");
  const [newBoardColor, setNewBoardColor] = useState("bg-blue-500");
  const [showUpgradeDialog, setShowUpgradeDialog] = useState<boolean>(false);

  // Edit Board dialog (NEW)
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingBoard, setEditingBoard] = useState<Board | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editColor, setEditColor] = useState("bg-blue-500");
  const [savingEdit, setSavingEdit] = useState(false);

  // Undo bar
  const [undo, setUndo] = useState<UndoBoardState>(null);
  const undoRef = useRef<UndoBoardState>(null);
  useEffect(() => {
    undoRef.current = undo;
  }, [undo]);
  useEffect(() => {
    return () => {
      if (undoRef.current?.timeoutId)
        window.clearTimeout(undoRef.current.timeoutId);
      if (undoRef.current?.intervalId)
        window.clearInterval(undoRef.current.intervalId);
    };
  }, []);

  const boardsWithTaskCount = useMemo<BoardWithCount[]>(
    () =>
      boards.map((b) => ({
        ...b,
        taskCount: boardCounts?.[b.id] ?? 0,
      })),
    [boards, boardCounts]
  );

  // Filters
  const filteredBoards = useMemo<BoardWithCount[]>(() => {
    const search = filters.search.trim().toLowerCase();

    return boardsWithTaskCount.filter((board) => {
      const matchesSearch =
        !search ||
        board.title.toLowerCase().includes(search) ||
        (board.description ?? "").toLowerCase().includes(search);

      const createdAt = new Date(board.created_at);
      const matchesDateRange =
        (!filters.dateRange.start ||
          createdAt >= new Date(filters.dateRange.start)) &&
        (!filters.dateRange.end ||
          createdAt <= new Date(filters.dateRange.end));

      const { min, max } = filters.taskCount;
      const matchesTaskCount =
        (min == null || board.taskCount >= min) &&
        (max == null || board.taskCount <= max);

      return matchesSearch && matchesDateRange && matchesTaskCount;
    });
  }, [boardsWithTaskCount, filters]);

  const activeFilterCount =
    (filters.search ? 1 : 0) +
    (filters.dateRange.start ? 1 : 0) +
    (filters.dateRange.end ? 1 : 0) +
    (filters.taskCount.min != null ? 1 : 0) +
    (filters.taskCount.max != null ? 1 : 0);

  const canCreateBoard = useMemo(
    () => !isFreeUser || boards.length < 1,
    [isFreeUser, boards.length]
  );

  // Create board dialog handlers
  function openCreateDialog() {
    if (!canCreateBoard) {
      setShowUpgradeDialog(true);
      return;
    }
    setNewBoardTitle("");
    setNewBoardDesc("");
    setNewBoardColor("bg-blue-500");
    setIsCreateOpen(true);
  }

  async function handleSubmitCreateBoard(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreateBoard) {
      setShowUpgradeDialog(true);
      return;
    }
    if (!newBoardTitle.trim() || creating) return;
    setCreating(true);
    try {
      await createBoard({
        title: newBoardTitle.trim(),
        description: newBoardDesc.trim() || undefined,
        color: newBoardColor,
      });
      setIsCreateOpen(false);
    } finally {
      setCreating(false);
    }
  }

  function openEditDialog(b: Board) {
    setEditingBoard(b);
    setEditTitle(b.title);
    setEditDesc(b.description ?? "");
    setEditColor(b.color ?? "bg-blue-500");
    setIsEditOpen(true);
  }

  // Save Edit (NEW)
  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBoard || savingEdit) return;
    if (!editTitle.trim()) return;
    setSavingEdit(true);
    try {
      await updateBoard(editingBoard.id, {
        title: editTitle.trim(),
        description: editDesc.trim() || null,
        color: editColor,
      });
      setIsEditOpen(false);
      setEditingBoard(null);
    } finally {
      setSavingEdit(false);
    }
  }

  // Filters
  const clearFilters = () => setFilters(initialFilters);

  // Delete & Undo
  async function handleDeleteBoard(e: React.MouseEvent, boardId: string) {
    e.preventDefault();
    e.stopPropagation();

    const ok = window.confirm(
      "Delete this board and all its columns & tasks? You’ll have a short Undo window."
    );
    if (!ok) return;

    // cancel existing timers
    if (undoRef.current?.timeoutId)
      window.clearTimeout(undoRef.current.timeoutId);
    if (undoRef.current?.intervalId)
      window.clearInterval(undoRef.current.intervalId);

    const snapshot = await deleteBoard(boardId);
    if (!snapshot) return;

    const timeoutId = window.setTimeout(() => {
      if (undoRef.current?.intervalId)
        window.clearInterval(undoRef.current.intervalId);
      setUndo(null);
    }, UNDO_SECONDS * 1000);

    const intervalId = window.setInterval(() => {
      setUndo((prev) => {
        if (!prev) return prev;
        const nextRemaining = Math.max(0, prev.remaining - 1);
        return { ...prev, remaining: nextRemaining };
      });
    }, 1000);

    setUndo({ snapshot, timeoutId, intervalId, remaining: UNDO_SECONDS });
  }

  async function handleUndo() {
    const s = undoRef.current;
    if (!s) return;
    if (s.timeoutId) window.clearTimeout(s.timeoutId);
    if (s.intervalId) window.clearInterval(s.intervalId);
    await restoreBoard(s.snapshot);
    setUndo(null);
  }

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-2">Error loading boards</h2>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Welcome back,{" "}
            {user?.firstName ?? user?.emailAddresses[0].emailAddress}! 👋
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s what&apos;s happening with your boards today.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                    Total Boards
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-foreground">
                    {boards.length}
                  </p>
                </div>
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg flex items-center justify-center bg-secondary">
                  <Trello className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                    Active Projects
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-foreground">
                    {boards.length}
                  </p>
                </div>
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg flex items-center justify-center bg-secondary">
                  <Rocket className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                    Recent Activity
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-foreground">
                    {
                      boards.filter((board) => {
                        const updatedAt = new Date(board.updated_at);
                        const oneWeekAgo = new Date();
                        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                        return updatedAt > oneWeekAgo;
                      }).length
                    }
                  </p>
                </div>
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg flex items-center justify-center bg-purple-100">
                  📊
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                    Total Boards
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-foreground">
                    {boards.length}
                  </p>
                </div>
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg flex items-center justify-center bg-secondary">
                  <Trello className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Boards header & controls */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 space-y-4 sm:space-y-0">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                Your Boards
              </h2>
              <p className="text-muted-foreground">
                Manage your projects and tasks
              </p>
              {isFreeUser && (
                <p className="text-sm text-muted-foreground mt-1">
                  Free Plan: {boards.length}/1 boards used
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <div className="flex items-center space-x-2 bg-card border rounded-[9px] p-1">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3X3 />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                >
                  <List />
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFilterOpen(true)}
              >
                <Filter />
                {` Filter${activeFilterCount ? ` (${activeFilterCount})` : ""}`}
              </Button>

              <Button onClick={openCreateDialog}>
                <Plus />
                Create Board
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4 sm:mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="searchBoards"
              placeholder="Search boards..."
              className="pl-10 focus-brand"
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value }))
              }
            />
          </div>

          {/* Loading / Boards list */}
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="animate-spin" />
              <span>Loading your boards...</span>
            </div>
          )}

          {!loading &&
            (filteredBoards.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No boards match your filters.
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {filteredBoards.map((board) => (
                  <Link href={`/boards/${board.id}`} key={board.id}>
                    <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 ${board.color} rounded`} />
                            <Badge className="text-xs" variant="secondary">
                              {"taskCount" in board
                                ? (board as any).taskCount
                                : 0}{" "}
                              tasks
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            {/* NEW: Edit */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openEditDialog(board);
                              }}
                              aria-label="Edit board"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {/* Delete */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleDeleteBoard(e, board.id)}
                              aria-label="Delete board"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 sm:p-6">
                        <CardTitle className="text-base sm:text-lg mb-2 group-hover:text-blue-600 transition-colors">
                          {board.title}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {board.description}
                        </CardDescription>
                        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground space-y-1 sm:space-y-0">
                          <span>
                            Created{" "}
                            {new Date(board.created_at).toLocaleDateString()}
                          </span>
                          <span>
                            Updated{" "}
                            {new Date(board.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}

                {/* Create new board card */}
                <Card
                  role="button"
                  tabIndex={0}
                  aria-busy={creating}
                  onClick={openCreateDialog}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") openCreateDialog();
                  }}
                  className={`border-2 border-dashed hover:border-blue-400 transition-colors cursor-pointer group ${
                    creating ? "opacity-60 pointer-events-none" : ""
                  }`}
                >
                  <CardContent className="p-4 sm:p-6 flex flex-col items-center justify-center h-full min-h-[200px]">
                    {!creating ? (
                      <Plus className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground group-hover:text-blue-600 mb-2" />
                    ) : (
                      <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-muted-foreground mb-2" />
                    )}
                    <p className="text-sm sm:text-base text-muted-foreground group-hover:text-blue-600 font-medium">
                      {creating ? "Creating..." : "Create new board"}
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div>
                {filteredBoards.map((board) => (
                  <div key={board.id} className="mt-4 first:mt-0">
                    <Link href={`/boards/${board.id}`}>
                      <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-4 h-4 ${board.color} rounded`}
                              />
                              <Badge className="text-xs" variant="secondary">
                                {"taskCount" in board
                                  ? (board as any).taskCount
                                  : 0}{" "}
                                tasks
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openEditDialog(board);
                                }}
                                aria-label="Edit board"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => handleDeleteBoard(e, board.id)}
                                aria-label="Delete board"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6">
                          <CardTitle className="text-base sm:text-lg mb-2 group-hover:text-blue-600 transition-colors">
                            {board.title}
                          </CardTitle>
                          <CardDescription className="text-sm">
                            {board.description}
                          </CardDescription>
                          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground space-y-1 sm:space-y-0">
                            <span>
                              Created{" "}
                              {new Date(board.created_at).toLocaleDateString()}
                            </span>
                            <span>
                              Updated{" "}
                              {new Date(board.updated_at).toLocaleDateString()}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </div>
                ))}

                {/* Create new board card (list view) */}
                <Card
                  role="button"
                  tabIndex={0}
                  aria-busy={creating}
                  onClick={openCreateDialog}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") openCreateDialog();
                  }}
                  className={`mt-4 border-2 border-dashed hover:border-blue-400 transition-colors cursor-pointer group ${
                    creating ? "opacity-60 pointer-events-none" : ""
                  }`}
                >
                  <CardContent className="p-4 sm:p-6 flex flex-col items-center justify-center h-full min-h-[200px]">
                    {!creating ? (
                      <Plus className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground group-hover:text-blue-600 mb-2" />
                    ) : (
                      <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-muted-foreground mb-2" />
                    )}
                    <p className="text-sm sm:text-base text-muted-foreground group-hover:text-blue-600 font-medium">
                      {creating ? "Creating..." : "Create new board"}
                    </p>
                  </CardContent>
                </Card>
              </div>
            ))}
        </div>
      </main>

      {/* Filter dialog */}
      <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <DialogContent className="w-[95vw] max-w-[425px] mx-auto bg-card">
          <DialogHeader>
            <DialogTitle>Filter Boards</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Filter boards by title, date, or task count.
            </p>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="filterSearch">Search</Label>
              <Input
                id="filterSearch"
                placeholder="Search board titles..."
                value={filters.search}
                className="focus-brand"
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Date Range</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs" htmlFor="filterStart">
                    Start Date
                  </Label>
                  <Input
                    id="filterStart"
                    type="date"
                    value={filters.dateRange.start ?? ""}
                    className="focus-brand"
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        dateRange: {
                          ...prev.dateRange,
                          start: e.target.value || null,
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs" htmlFor="filterEnd">
                    End Date
                  </Label>
                  <Input
                    id="filterEnd"
                    type="date"
                    value={filters.dateRange.end ?? ""}
                    className="focus-brand"
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        dateRange: {
                          ...prev.dateRange,
                          end: e.target.value || null,
                        },
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Task Count</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs" htmlFor="filterMinTasks">
                    Minimum
                  </Label>
                  <Input
                    id="filterMinTasks"
                    type="number"
                    min="0"
                    placeholder="Min tasks"
                    value={filters.taskCount.min ?? ""}
                    className="focus-brand"
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        taskCount: {
                          ...prev.taskCount,
                          min: e.target.value ? Number(e.target.value) : null,
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs" htmlFor="filterMaxTasks">
                    Maximum
                  </Label>
                  <Input
                    id="filterMaxTasks"
                    type="number"
                    min="0"
                    placeholder="Max tasks"
                    value={filters.taskCount.max ?? ""}
                    className="focus-brand"
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        taskCount: {
                          ...prev.taskCount,
                          max: e.target.value ? Number(e.target.value) : null,
                        },
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between p-4 space-y-2 sm:space-y-0 sm:space-x-2">
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
            <Button onClick={() => setIsFilterOpen(false)}>
              Apply filters
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Board Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="w-[95vw] max-w-[425px] mx-auto bg-card">
          <DialogHeader>
            <DialogTitle>Create Board</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Name your board and pick a color
            </p>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmitCreateBoard}>
            <div className="space-y-2">
              <Label htmlFor="cbTitle">Title *</Label>
              <Input
                id="cbTitle"
                value={newBoardTitle}
                onChange={(e) => setNewBoardTitle(e.target.value)}
                placeholder="e.g. Marketing Roadmap"
                required
                className="focus-brand"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cbDesc">Description (optional)</Label>
              <Textarea
                id="cbDesc"
                value={newBoardDesc}
                onChange={(e) => setNewBoardDesc(e.target.value)}
                placeholder="Short description"
                className="focus-brand"
              />
            </div>

            <div className="space-y-2">
              <Label>Board Color</Label>
              <div className="grid grid-cols-6 gap-2">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full ${color} ${
                      color === newBoardColor
                        ? "ring-2 ring-offset-2 ring-foreground ring-offset-background"
                        : ""
                    }`}
                    aria-label={`Pick ${color}`}
                    onClick={() => setNewBoardColor(color)}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Board"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT Board Dialog (NEW) */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="w-[95vw] max-w-[425px] mx-auto bg-card">
          <DialogHeader>
            <DialogTitle>Edit Board</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Update title, description, and color
            </p>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSaveEdit}>
            <div className="space-y-2">
              <Label htmlFor="ebTitle">Title *</Label>
              <Input
                id="ebTitle"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Board title"
                required
                className="focus-brand"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ebDesc">Description</Label>
              <Textarea
                id="ebDesc"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Short description"
                className="focus-brand"
              />
            </div>

            <div className="space-y-2">
              <Label>Board Color</Label>
              <div className="grid grid-cols-6 gap-2">
                {COLOR_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full ${color} ${
                      color === editColor
                        ? "ring-2 ring-offset-2 ring-foreground ring-offset-background"
                        : ""
                    }`}
                    aria-label={`Pick ${color}`}
                    onClick={() => setEditColor(color)}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upgrade gating dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="w-[95vw] max-w-[425px] mx-auto bg-card">
          <DialogHeader>
            <DialogTitle>Upgrade To Create More Boards</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Free users can only create one board. Upgrade to Pro or Enterprise
              to create unlimited boards.
            </p>
          </DialogHeader>
          <div className="flex justify-end space-x-4 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowUpgradeDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={() => router.push("/pricing")}>View Plans</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Undo bar with countdown */}
      {undo && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <Card className="shadow-lg">
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <span className="text-sm">Board deleted.</span>
              <Button size="sm" variant="outline" onClick={handleUndo}>
                Undo ({undo.remaining}s)
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
