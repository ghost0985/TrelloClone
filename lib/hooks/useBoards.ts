// File: src/lib/hooks/useBoards.ts
"use client";

import { useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  boardDataService,
  boardService,
  columnService,
  taskService,
  taskStatsService,
} from "../services";
import { Board, Column, ColumnWithTasks, Task } from "../supabase/models";
import { useSupabase } from "../supabase/SupabaseProvider";

/** Snapshot for deleting/restoring a whole board */
type BoardDeletedSnapshot = {
  board: Board;
  columns: Column[];
  tasks: Task[];
};

/** Snapshot for deleting/restoring a single task */
type DeletedSnapshot = {
  task: Task;
  columnId: string;
  index: number;
};

/* ──────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────── */

/** Convert empty strings to null, drop undefined, keep other values as-is */
function sanitizeTaskUpdates(updates: Partial<Task>): Partial<Task> {
  const out: Partial<Task> = {};
  for (const [key, value] of Object.entries(updates) as [keyof Task, any][]) {
    if (value === undefined) continue;
    if (key === "due_date" || key === "description" || key === "assignee") {
      out[key] = value === "" ? null : value;
    } else {
      out[key] = value;
    }
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────
   useBoards (list page)
   ────────────────────────────────────────────────────────────── */
export function useBoards() {
  const { user } = useUser();
  const { supabase } = useSupabase();

  const [boards, setBoards] = useState<Board[]>([]);
  const [boardCounts, setBoardCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const ready = useMemo(() => Boolean(user?.id && supabase), [user?.id, supabase]);

  const loadBoards = useCallback(async () => {
    if (!user?.id || !supabase) return;
    try {
      setLoading(true);
      setError(null);

      const data = await boardService.getBoards(supabase, user.id);
      setBoards(data);

      const ids = data.map((b) => b.id);
      const counts = await taskStatsService.countForBoards(supabase, ids);
      setBoardCounts(counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load boards.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, supabase]);

  useEffect(() => {
    if (!ready) return;
    void loadBoards();
  }, [ready, loadBoards]);

  async function createBoard(boardData: {
    title: string;
    description?: string;
    color?: string;
  }) {
    if (!user?.id || !supabase) throw new Error("Not ready yet.");
    try {
      const newBoard = await boardDataService.createBoardWithDefaultColumns(supabase, {
        ...boardData,
        userId: user.id,
      });
      setBoards((prev) => [newBoard, ...prev]);
      setBoardCounts((prev) => ({ ...prev, [newBoard.id]: 0 }));
      return newBoard;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create board.");
      console.error(err);
    }
  }

  async function updateBoard(id: string, updates: Partial<Board>): Promise<Board | undefined> {
    if (!supabase) throw new Error("Not ready yet");
    try {
      // Let DB trigger handle updated_at
      const updated = await boardService.updateBoard(supabase, id, updates);
      setBoards((prev) => prev.map((b) => (b.id === id ? updated : b)));
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update board.");
      console.error(err);
    }
  }

  async function deleteBoard(boardId: string): Promise<BoardDeletedSnapshot | undefined> {
    if (!supabase) throw new Error("Not ready yet");

    let snapshot: BoardDeletedSnapshot | undefined;
    try {
      const deep = await boardDataService.getBoardDeep(supabase, boardId);
      snapshot = {
        board: deep.board,
        columns: deep.columns,
        tasks: deep.tasks,
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to snapshot board.");
      console.error(err);
      return;
    }

    // Optimistic remove locally
    setBoards((prev) => prev.filter((b) => b.id !== boardId));
    setBoardCounts((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([id]) => id !== boardId))
    );

    try {
      await boardService.deleteBoard(supabase, boardId);
      return snapshot;
    } catch (err) {
      // Rollback on failure
      if (snapshot) {
        setBoards((prev) => [snapshot.board, ...prev]);
        setBoardCounts((prev) => ({
          ...prev,
          [snapshot.board.id]: snapshot.tasks.length,
        }));
      }
      setError(err instanceof Error ? err.message : "Failed to delete board.");
      console.error(err);
    }
  }

  async function restoreBoard(snapshot: BoardDeletedSnapshot): Promise<Board | undefined> {
    if (!supabase) throw new Error("Not ready yet.");

    try {
      // Recreate board
      const recreateBoard = await boardService.createBoard(supabase, {
        title: snapshot.board.title,
        description: snapshot.board.description,
        color: snapshot.board.color,
        user_id: snapshot.board.user_id,
      });

      // Recreate columns (preserve order)
      const colIdMap = new Map<string, string>();
      for (const c of [...snapshot.columns].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
      )) {
        const newCol = await columnService.createColumn(supabase, {
          title: c.title,
          sort_order: c.sort_order ?? 0,
          board_id: recreateBoard.id,
          user_id: c.user_id,
        });
        colIdMap.set(c.id, newCol.id);
      }

      // Recreate tasks
      for (const t of snapshot.tasks) {
        const newColumnId = colIdMap.get(t.column_id);
        if (!newColumnId) continue;
        await taskService.createTask(supabase, {
          title: t.title,
          description: t.description,
          assignee: t.assignee,
          due_date: t.due_date,
          priority: (t.priority as "low" | "medium" | "high") ?? "medium",
          sort_order: t.sort_order ?? 0,
          column_id: newColumnId,
        });
      }

      setBoards((prev) => [recreateBoard, ...prev]);
      setBoardCounts((prev) => ({
        ...prev,
        [recreateBoard.id]: snapshot.tasks.length,
      }));

      return recreateBoard;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore board.");
      console.error(err);
    }
  }

  return {
    boards,
    boardCounts,
    loading,
    error,
    createBoard,
    updateBoard,
    reloadBoards: loadBoards,
    deleteBoard,
    restoreBoard,
  };
}

/* ──────────────────────────────────────────────────────────────
   useBoard (single board page)
   ────────────────────────────────────────────────────────────── */
export function useBoard(boardId: string) {
  const { supabase } = useSupabase();
  const { user } = useUser();

  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<ColumnWithTasks[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const ready = useMemo(() => Boolean(boardId && supabase), [boardId, supabase]);

  const loadBoard = useCallback(async () => {
    if (!boardId || !supabase) return;
    try {
      setLoading(true);
      setError(null);
      const data = await boardDataService.getBoardwithColumns(supabase, boardId);
      setBoard(data.board);
      setColumns(data.columnsWithTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load board.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [boardId, supabase]);

  useEffect(() => {
    if (!ready) return;
    void loadBoard();
  }, [ready, loadBoard]);

  async function updateBoardLocal(id: string, updates: Partial<Board>) {
    if (!supabase) throw new Error("Not ready yet");
    try {
      const updated = await boardService.updateBoard(supabase, id, updates);
      setBoard(updated);
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update the board.");
      console.error(err);
    }
  }

  async function createRealTask(
    columnId: string,
    taskData: {
      title: string;
      description?: string;
      assignee?: string;
      dueDate?: string;
      priority?: "low" | "medium" | "high";
    }
  ) {
    if (!supabase) throw new Error("Not ready yet");
    try {
      const sortOrder = columns.find((c) => c.id === columnId)?.tasks.length ?? 0;
      const newTask = await taskService.createTask(supabase, {
        title: taskData.title,
        description: taskData.description ?? null,
        assignee: taskData.assignee ?? null,
        due_date: taskData.dueDate ?? null,
        column_id: columnId,
        sort_order: sortOrder,
        priority: taskData.priority ?? "medium",
      });

      setColumns((prev) =>
        prev.map((col) =>
          col.id === columnId ? { ...col, tasks: [...col.tasks, newTask] } : col
        )
      );

      return newTask;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create the task.");
      console.error(err);
    }
  }

  async function moveTask(taskId: string, newColumnId: string, newOrder: number) {
    if (!supabase) throw new Error("Not ready yet");
    try {
      const updated = await taskService.moveTask(supabase, taskId, newColumnId, newOrder);

      setColumns((prev) => {
        const next = prev.map((c) => ({ ...c, tasks: [...c.tasks] }));

        // Remove from current location
        for (const c of next) {
          const idx = c.tasks.findIndex((t) => t.id === taskId);
          if (idx !== -1) {
            c.tasks.splice(idx, 1);
            break;
          }
        }

        // Insert to target and sort by sort_order if present
        const target = next.find((c) => c.id === updated.column_id);
        if (target) {
          target.tasks.push(updated);
          target.tasks.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        }

        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move task");
      console.error(err);
      // Fallback could be: void loadBoard();
    }
  }

  async function updateTask(taskId: string, updates: Partial<Task>) {
    if (!supabase) throw new Error("Not ready yet");
    try {
      // 🔧 SANITIZE: convert "" → null for text/date fields and drop undefined
      const clean = sanitizeTaskUpdates(updates);

      const updatedTask = await taskService.updateTask(supabase, taskId, clean);
      if (!updatedTask) {
        // If backend returned nothing (shouldn't happen), hard refresh the board
        await loadBoard();
        return;
      }

      // Update UI to match server result (and move between columns if needed)
      setColumns((prev) => {
        const next = prev.map((c) => ({ ...c, tasks: [...c.tasks] }));

        // Remove from wherever it currently lives
        for (const c of next) {
          const idx = c.tasks.findIndex((t) => t.id === taskId);
          if (idx !== -1) {
            c.tasks.splice(idx, 1);
            break;
          }
        }

        // Insert into its (possibly new) column
        const target = next.find((c) => c.id === updatedTask.column_id);
        if (target) {
          target.tasks.push(updatedTask);
          target.tasks.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        }

        return next;
      });

      return updatedTask;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task.");
      console.error(err);
    }
  }

  async function createColumn(title: string) {
    if (!board || !user?.id || !supabase) throw new Error("Not ready yet");
    try {
      const newColumn = await columnService.createColumn(supabase, {
        title,
        board_id: board.id,
        sort_order: columns.length,
        user_id: user.id,
      });
      setColumns((prev) => [...prev, { ...newColumn, tasks: [] }]);
      return newColumn;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create new column");
      console.error(err);
    }
  }

  async function updateColumn(columnId: string, title: string) {
    if (!supabase) throw new Error("Not ready yet");
    try {
      const updatedColumn = await columnService.updateColumnTitle(supabase, columnId, title);
      setColumns((prev) =>
        prev.map((col) => (col.id === columnId ? { ...col, ...updatedColumn } : col))
      );
      return updatedColumn;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update column");
      console.error(err);
    }
  }

  async function deleteTask(taskId: string): Promise<DeletedSnapshot | undefined> {
    if (!supabase) throw new Error("Not ready yet");

    const containing = columns.find((c) => c.tasks.some((t) => t.id === taskId));
    if (!containing) return;
    const index = containing.tasks.findIndex((t) => t.id === taskId);
    const task = containing.tasks[index];

    // Optimistic remove
    setColumns((prev) =>
      prev.map((c) =>
        c.id === containing.id ? { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) } : c
      )
    );

    try {
      await taskService.deleteTask(supabase, taskId);
      return { task, columnId: containing.id, index };
    } catch (err) {
      // Rollback on failure
      setColumns((prev) =>
        prev.map((c) =>
          c.id === containing.id
            ? {
                ...c,
                tasks: [...c.tasks.slice(0, index), task, ...c.tasks.slice(index)],
              }
            : c
        )
      );
      setError(err instanceof Error ? err.message : "Failed to delete task.");
      console.error(err);
    }
  }

  return {
    board,
    columns,
    loading,
    error,
    updateBoard: updateBoardLocal,
    createRealTask,
    setColumns,
    moveTask,
    createColumn,
    updateColumn,
    updateTask,
    deleteTask,
  };
}
