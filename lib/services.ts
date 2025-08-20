import { SupabaseClient } from "@supabase/supabase-js";
import { Board, Column, Task } from "./supabase/models";

/* ------------------------------------------------------------------
   Helpers
-------------------------------------------------------------------*/
async function touchBoard(
  supabase: SupabaseClient,
  boardId: string
): Promise<void> {
  // Force-bump updated_at on the board
  const { error } = await supabase
    .from("boards")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", boardId);
  if (error) throw error;
}

async function getBoardIdByColumnId(
  supabase: SupabaseClient,
  columnId: string
): Promise<string> {
  const { data, error } = await supabase
    .from("columns")
    .select("board_id")
    .eq("id", columnId)
    .single();
  if (error) throw error;
  return data.board_id as string;
}

/* ------------------------------ Boards ------------------------------ */
export const boardService = {
  async getBoard(supabase: SupabaseClient, boardId: string): Promise<Board> {
    const { data, error } = await supabase
      .from("boards")
      .select("*")
      .eq("id", boardId)
      .single();
    if (error) throw error;
    return data as Board;
  },

  async getBoards(supabase: SupabaseClient, userId: string): Promise<Board[]> {
    const { data, error } = await supabase
      .from("boards")
      .select("*")
      .eq("user_id", userId)
      // show most recently updated first (fallback to created_at)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as Board[];
  },

  async createBoard(
    supabase: SupabaseClient,
    board: Omit<Board, "id" | "created_at" | "updated_at">
  ): Promise<Board> {
    const { data, error } = await supabase
      .from("boards")
      .insert(board)
      .select("*")
      .single();
    if (error) throw error;
    return data as Board;
  },

  async updateBoard(
    supabase: SupabaseClient,
    boardId: string,
    updates: Partial<Board>
  ): Promise<Board> {
    // Force `updated_at` bump for direct edits
    const { data, error } = await supabase
      .from("boards")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", boardId)
      .select("*")
      .single();
    if (error) throw error;
    return data as Board;
  },

  async deleteBoard(
    supabase: SupabaseClient,
    boardId: string
  ): Promise<Board> {
    const { data, error } = await supabase
      .from("boards")
      .delete()
      .eq("id", boardId)
      .select("*")
      .single();
    if (error) throw error;
    return data as Board;
  },
};

/* ------------------------------ Columns ----------------------------- */
export const columnService = {
  async getColumns(
    supabase: SupabaseClient,
    boardId: string
  ): Promise<Column[]> {
    const { data, error } = await supabase
      .from("columns")
      .select("*")
      .eq("board_id", boardId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data || []) as Column[];
  },

  async createColumn(
    supabase: SupabaseClient,
    column: Omit<Column, "id" | "created_at">
  ): Promise<Column> {
    const { data, error } = await supabase
      .from("columns")
      .insert(column)
      .select("*")
      .single();
    if (error) throw error;

    // Touch parent board
    await touchBoard(supabase, (data as Column).board_id);

    return data as Column;
  },

  async updateColumnTitle(
    supabase: SupabaseClient,
    columnId: string,
    title: string
  ): Promise<Column> {
    const { data, error } = await supabase
      .from("columns")
      .update({ title })
      .eq("id", columnId)
      .select("*")
      .single();
    if (error) throw error;

    // Touch parent board
    await touchBoard(supabase, (data as Column).board_id);

    return data as Column;
  },
};

/* ------------------------------- Tasks ------------------------------ */
export const taskService = {
  async getTasksByBoard(
    supabase: SupabaseClient,
    boardId: string
  ): Promise<Task[]> {
    const { data, error } = await supabase
      .from("tasks")
      .select(`*, columns!inner(board_id)`)
      .eq("columns.board_id", boardId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data || []) as Task[];
  },

  async createTask(
    supabase: SupabaseClient,
    task: Omit<Task, "id" | "created_at" | "updated_at">
  ): Promise<Task> {
    const { data, error } = await supabase
      .from("tasks")
      .insert(task)
      .select("*")
      .single();
    if (error) throw error;
    const created = data as Task;

    // Touch parent board
    const boardId = await getBoardIdByColumnId(supabase, created.column_id);
    await touchBoard(supabase, boardId);

    return created;
  },

  async updateTask(
    supabase: SupabaseClient,
    taskId: string,
    updates: Partial<Task>
  ): Promise<Task> {
    return taskService.editTaskInColumn(supabase, { taskId, updates });
  },

  async moveTask(
    supabase: SupabaseClient,
    taskId: string,
    newColumnId: string,
    newOrder: number
  ): Promise<Task> {
    return taskService.editTaskInColumn(supabase, {
      taskId,
      columnId: newColumnId,
      sortOrder: newOrder,
    });
  },

  async editTaskInColumn(
    supabase: SupabaseClient,
    params: {
      taskId: string;
      updates?: Partial<
        Omit<Task, "id" | "column_id" | "sort_order" | "created_at" | "updated_at">
      >;
      columnId?: string;
      sortOrder?: number;
    }
  ): Promise<Task> {
    const { taskId, updates, columnId, sortOrder } = params;

    const patch: Partial<Task> = {
      ...(updates ?? {}),
      ...(columnId !== undefined ? { column_id: columnId } : {}),
      ...(sortOrder !== undefined ? { sort_order: sortOrder } : {}),
      // ensure task updated_at bumps too (if you have a trigger, you can omit this)
      updated_at: new Date().toISOString(),
    } as Partial<Task>;

    const { data, error } = await supabase
      .from("tasks")
      .update(patch)
      .eq("id", taskId)
      .select("*")
      .single();

    if (error) throw error;
    const updated = data as Task;

    // Touch parent board
    const boardId = await getBoardIdByColumnId(supabase, updated.column_id);
    await touchBoard(supabase, boardId);

    return updated;
  },

  async deleteTask(supabase: SupabaseClient, taskId: string): Promise<Task> {
    const { data, error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .select("*")
      .single();
    if (error) throw error;
    const deleted = data as Task;

    // Touch parent board
    const boardId = await getBoardIdByColumnId(supabase, deleted.column_id);
    await touchBoard(supabase, boardId);

    return deleted;
  },
};

/* --------------------------- Task Stats (counts) -------------------- */
export const taskStatsService = {
  async countForBoard(
    supabase: SupabaseClient,
    boardId: string
  ): Promise<number> {
    const { count, error } = await supabase
      .from("tasks")
      .select("id, columns!inner(board_id)", { count: "exact", head: true })
      .eq("columns.board_id", boardId);
    if (error) throw error;
    return count ?? 0;
  },

  async countForBoards(
    supabase: SupabaseClient,
    boardIds: string[]
  ): Promise<Record<string, number>> {
    const entries = await Promise.all(
      boardIds.map(async (id) => {
        try {
          const c = await this.countForBoard(supabase, id);
          return [id, c] as const;
        } catch {
          return [id, 0] as const;
        }
      })
    );
    return Object.fromEntries(entries);
  },
};

/* -------------------------- Board + Columns ------------------------- */
export const boardDataService = {
  async getBoardwithColumns(supabase: SupabaseClient, boardId: string) {
    const [board, columns] = await Promise.all([
      boardService.getBoard(supabase, boardId),
      columnService.getColumns(supabase, boardId),
    ]);
    if (!board) throw new Error("Board not found");

    const tasks = await taskService.getTasksByBoard(supabase, boardId);
    const columnsWithTasks = columns.map((column) => ({
      ...column,
      tasks: tasks.filter((task) => task.column_id === column.id),
    }));

    return { board, columnsWithTasks };
  },

  async createBoardWithDefaultColumns(
    supabase: SupabaseClient,
    boardData: {
      title: string;
      description?: string;
      color?: string;
      userId: string;
    }
  ) {
    const board = await boardService.createBoard(supabase, {
      title: boardData.title,
      description: boardData.description || null,
      color: boardData.color || "bg-blue-500",
      user_id: boardData.userId,
    });

    const defaults = [
      { title: "To Do", sort_order: 0 },
      { title: "In Progress", sort_order: 1 },
      { title: "Review", sort_order: 2 },
      { title: "Done", sort_order: 3 },
    ];

    await Promise.all(
      defaults.map((c) =>
        columnService.createColumn(supabase, {
          ...c,
          board_id: board.id,
          user_id: boardData.userId,
        })
      )
    );

    return board;
  },

  async getBoardDeep(
    supabase: SupabaseClient,
    boardId: string
  ): Promise<{ board: Board; columns: Column[]; tasks: Task[] }> {
    const { board, columnsWithTasks } =
      await boardDataService.getBoardwithColumns(supabase, boardId);

    const columns: Column[] = columnsWithTasks.map(({ tasks, ...col }) => col);
    const tasks: Task[] = columnsWithTasks.flatMap((c) => c.tasks);

    return { board, columns, tasks };
  },
};
