"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
import {
  boardDataService,
  boardService,
  columnService,
  taskService,
  taskStatsService,
} from "../services";
import { Board, ColumnWithTasks, Task } from "../supabase/models";
import { useSupabase } from "../supabase/SupabaseProvider";

type BoardDeletedSnapshot = {
  board: Board;
  columns: any[];
  tasks: Task[];
};

type DeletedSnapshot = {
  task: Task;
  columnId: string;
  index: number;
};

export function useBoards() {
  const { user } = useUser();
  const { supabase } = useSupabase();

  const [boards, setBoards] = useState<Board[]>([]);
  const [boardCounts, setBoardCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ready = useMemo(
    () => Boolean(user?.id && supabase),
    [user?.id, supabase]
  );

  useEffect(() => {
    if (!ready) return;
    void loadBoards();
  }, [ready]);

  async function loadBoards() {
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
    } finally {
      setLoading(false);
    }
  }

  async function createBoard(boardData: {
    title: string;
    description?: string;
    color?: string;
  }) {
    if (!user?.id || !supabase) throw new Error("Not ready yet.");
    try {
      const newBoard = await boardDataService.createBoardWithDefaultColumns(
        supabase,
        {
          ...boardData,
          userId: user.id,
        }
      );
      setBoards((prev) => [newBoard, ...prev]);
      setBoardCounts((prev) => ({ ...prev, [newBoard.id]: 0 }));
      return newBoard;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create board.");
    }
  }

  async function updateBoard(
    id: string,
    updates: Partial<Board>
  ): Promise<Board | undefined> {
    if (!supabase) throw new Error("Not ready yet");
    try {
      const updated = await boardService.updateBoard(supabase, id, updates);
      setBoards((prev) => prev.map((b) => (b.id === id ? updated : b)));
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update board.");
    }
  }

  async function deleteBoard(
    boardId: string
  ): Promise<BoardDeletedSnapshot | undefined> {
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
      setError(
        err instanceof Error ? err.message : "Failed to snapshot board."
      );
      return;
    }

    setBoards((prev) => prev.filter((b) => b.id !== boardId));
    setBoardCounts((prev) => {
      const { [boardId]: _removed, ...rest } = prev;
      return rest;
    });

    try {
      await boardService.deleteBoard(supabase, boardId);
      return snapshot;
    } catch (err) {
      if (snapshot) {
        setBoards((prev) => [snapshot.board, ...prev]);
        setBoardCounts((prev) => ({
          ...prev,
          [snapshot.board.id]: snapshot.tasks.length,
        }));
      }
      setError(err instanceof Error ? err.message : "Failed to delete board.");
    }
  }

  async function restoreBoard(
    snapshot: BoardDeletedSnapshot
  ): Promise<Board | undefined> {
    if (!supabase) throw new Error("Not ready yet.");

    try {
      const recreateBoard = await boardService.createBoard(supabase, {
        title: snapshot.board.title,
        description: snapshot.board.description,
        color: snapshot.board.color,
        user_id: snapshot.board.user_id,
      });

      const colIdMap = new Map<string, string>();
      for (const c of snapshot.columns.sort(
        (a: any, b: any) => a.sort_order - b.sort_order
      )) {
        const newCol = await columnService.createColumn(supabase, {
          title: c.title,
          sort_order: c.sort_order,
          board_id: recreateBoard.id,
          user_id: c.user_id,
        });
        colIdMap.set(c.id, newCol.id);
      }

      for (const t of snapshot.tasks) {
        const newColumnId = colIdMap.get((t as any).column_id);
        if (!newColumnId) continue;
        await taskService.createTask(supabase, {
          title: t.title,
          description: t.description,
          assignee: t.assignee,
          due_date: t.due_date,
          priority: (t.priority as "low" | "medium" | "high") ?? "medium",
          sort_order: t.sort_order,
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

export function useBoard(boardId: string) {
  const { supabase } = useSupabase();
  const { user } = useUser();

  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<ColumnWithTasks[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ready = useMemo(
    () => Boolean(boardId && supabase),
    [boardId, supabase]
  );

  useEffect(() => {
    if (!ready) return;
    void loadBoard();
  }, [ready]);

  async function loadBoard() {
    if (!boardId || !supabase) return;
    try {
      setLoading(true);
      setError(null);
      const data = await boardDataService.getBoardwithColumns(
        supabase,
        boardId
      );
      setBoard(data.board);
      setColumns(data.columnsWithTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load board.");
    } finally {
      setLoading(false);
    }
  }

  async function updateBoardLocal(id: string, updates: Partial<Board>) {
    if (!supabase) throw new Error("Not ready yet");
    try {
      const updated = await boardService.updateBoard(supabase, id, updates);
      setBoard(updated);
      return updated;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update the board."
      );
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
      const newTask = await taskService.createTask(supabase, {
        title: taskData.title,
        description: taskData.description || null,
        assignee: taskData.assignee || null,
        due_date: taskData.dueDate || null,
        column_id: columnId,
        sort_order: columns.find((c) => c.id === columnId)?.tasks.length || 0,
        priority: taskData.priority || "medium",
      });

      setColumns((prev) =>
        prev.map((col) =>
          col.id === columnId ? { ...col, tasks: [...col.tasks, newTask] } : col
        )
      );

      return newTask;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create the task."
      );
    }
  }

  async function moveTask(
    taskId: string,
    newColumnId: string,
    newOrder: number
  ) {
    if (!supabase) throw new Error("Not ready yet");
    try {
      await taskService.moveTask(supabase, taskId, newColumnId, newOrder);

      setColumns((prev) => {
        const next = prev.map((c) => ({ ...c, tasks: [...c.tasks] }));
        for (const c of next) {
          const idx = c.tasks.findIndex((t) => t.id === taskId);
          if (idx !== -1) c.tasks.splice(idx, 1);
        }
        const target = next.find((c) => c.id === newColumnId);
        if (target) {
          const pos = Math.max(0, Math.min(newOrder, target.tasks.length));
          target.tasks.splice(pos, 0, { id: taskId } as unknown as Task);
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move task");
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
      setError(
        err instanceof Error ? err.message : "Failed to create new column"
      );
    }
  }

  async function updateColumn(columnId: string, title: string) {
    if (!supabase) throw new Error("Not ready yet");
    try {
      const updatedColumn = await columnService.updateColumnTitle(
        supabase,
        columnId,
        title
      );
      setColumns((prev) =>
        prev.map((col) =>
          col.id === columnId ? { ...col, ...updatedColumn } : col
        )
      );
      return updatedColumn;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update column");
    }
  }

  async function updateTask(taskId: string, updates: Partial<Task>) {
    if (!supabase) throw new Error("Not ready yet");
    try {
      const updatedTask = await taskService.updateTask(
        supabase,
        taskId,
        updates
      );

      setColumns((prev) => {
        const next = prev.map((c) => ({ ...c, tasks: [...c.tasks] }));
        for (const c of next) {
          const idx = c.tasks.findIndex((t) => t.id === taskId);
          if (idx !== -1) {
            c.tasks.splice(idx, 1);
            break;
          }
        }
        const target = next.find((c) => c.id === updatedTask.column_id);
        if (target) target.tasks.push(updatedTask);
        return next;
      });

      return updatedTask;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task.");
    }
  }

  async function deleteTask(
    taskId: string
  ): Promise<DeletedSnapshot | undefined> {
    if (!supabase) throw new Error("Not ready yet");

    const containing = columns.find((c) =>
      c.tasks.some((t) => t.id === taskId)
    );
    if (!containing) return;
    const index = containing.tasks.findIndex((t) => t.id === taskId);
    const task = containing.tasks[index];

    setColumns((prev) =>
      prev.map((c) =>
        c.id === containing.id
          ? { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) }
          : c
      )
    );

    try {
      await taskService.deleteTask(supabase, taskId);
      return { task, columnId: containing.id, index };
    } catch (err) {
      setColumns((prev) =>
        prev.map((c) =>
          c.id === containing.id
            ? {
                ...c,
                tasks: [
                  ...c.tasks.slice(0, index),
                  task,
                  ...c.tasks.slice(index),
                ],
              }
            : c
        )
      );
      setError(err instanceof Error ? err.message : "Failed to delete task.");
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
