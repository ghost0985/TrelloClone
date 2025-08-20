"use client";

import Navbar from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Select,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useBoard } from "@/lib/hooks/useBoards";
import { ColumnWithTasks, Task } from "@/lib/supabase/models";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { Calendar, MoreHorizontal, Plus, User } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/* Local types */
type UndoState = null | {
  task: Task;
  columnId: string;
  timer: number;
  expiresAt: number;
};

const UNDO_MS = 5000;

/* Column container with droppable state */
function DroppableColumn({
  column,
  children,
  onCreateTask,
  onEditColumn,
  countToShow,
}: {
  column: ColumnWithTasks;
  children: React.ReactNode;
  onCreateTask: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onEditColumn: (column: ColumnWithTasks) => void;
  countToShow: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={`w-full lg:flex-shrink-0 lg:w-80 ${
        isOver ? "bg-blue-50 rounded-lg" : ""
      }`}
    >
      <div
        className={`bg-white dark:bg-card rounded-lg shadow-sm border ${
          isOver ? "ring-2 ring-blue-500 border-blue-500" : ""
        }`}
      >
        {/* Column Header */}
        <div className="p-3 sm:p-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-foreground text-sm sm:text-base truncate">
                {column.title}
              </h3>
              <Badge variant="secondary" className="text-xs flex-shrink-0">
                {countToShow}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="flex-shrink-0"
              onClick={() => onEditColumn(column)}
            >
              <MoreHorizontal />
            </Button>
          </div>
        </div>

        {/* Column Body */}
        <div className="p-2">
          {children}
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                className="w-full mt-3 text-gray-500 hover:text-gray-700 dark:text-muted-foreground"
              >
                <Plus />
                Add Task
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-[425px] mx-auto">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <p className="text-sm text-gray-600 dark:text-muted-foreground">
                  Add a task to this column
                </p>
              </DialogHeader>

              <form className="space-y-4" onSubmit={onCreateTask}>
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input
                    id="title"
                    name="title"
                    placeholder="Enter task title"
                    required
                    className="focus-brand"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Enter task description"
                    rows={3}
                    className="focus-brand"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Assignee</Label>
                  <Input
                    id="assignee"
                    name="assignee"
                    placeholder="Who should do this?"
                    className="focus-brand"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select name="priority" defaultValue="medium">
                    <SelectTrigger className="focus-brand">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["low", "medium", "high"].map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {priority.charAt(0).toUpperCase() + priority.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    id="dueDate"
                    name="dueDate"
                    className="focus-brand"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="submit">Create Task</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}

/* Sortable task card */
function SortableTask({ task, onClick }: { task: Task; onClick?: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });
  const styles = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getPriorityColor = (priority?: string): string => {
    const key = priority?.trim().toLowerCase();
    switch (key) {
      case "high":
        return "bg-red-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-green-500";
      default:
        return "bg-yellow-500";
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={styles}
      {...listeners}
      {...attributes}
      onClick={onClick}
    >
      <Card className="cursor-pointer hover:shadow-md transition-shadow">
        <CardContent className="p-3 sm:p-4">
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-start justify-between">
              <h4 className="font-medium text-gray-900 dark:text-foreground text-sm leading-tight flex-1 min-w-0 pr-2">
                {task.title}
              </h4>
            </div>
            <p className="text-xs text-gray-600 dark:text-muted-foreground line-clamp-2">
              {task.description || "No description."}
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1 sm:space-x-2 min-w-0">
                {task.assignee && (
                  <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span className="truncate">{task.assignee}</span>
                  </div>
                )}
                {task.due_date && (
                  <div className="flex items-center space-x-1 sm:space-x-2 min-w-0">
                    <Calendar className="h-3 w-3" />
                    <span className="truncate">{task.due_date}</span>
                  </div>
                )}
              </div>
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${getPriorityColor(
                  task.priority
                )}`}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TaskOverlay({ task }: { task: Task }) {
  const getPriorityColor = (priority?: string): string => {
    const key = priority?.trim().toLowerCase();
    switch (key) {
      case "high":
        return "bg-red-500";
      case "medium":
        return "bg-yellow-500";
      case "low":
        return "bg-green-500";
      default:
        return "bg-yellow-500";
    }
  };

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow">
      <CardContent className="p-3 sm:p-4">
        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-start justify-between">
            <h4 className="font-medium text-gray-900 dark:text-foreground text-sm leading-tight flex-1 min-w-0 pr-2">
              {task.title}
            </h4>
          </div>
          <p className="text-xs text-gray-600 dark:text-muted-foreground line-clamp-2">
            {task.description || "No description."}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1 sm:space-x-2 min-w-0">
              {task.assignee && (
                <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span className="truncate">{task.assignee}</span>
                </div>
              )}
              {task.due_date && (
                <div className="flex items-center space-x-1 sm:space-x-2 min-w-0">
                  <Calendar className="h-3 w-3" />
                  <span className="truncate">{task.due_date}</span>
                </div>
              )}
            </div>
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ${getPriorityColor(
                task.priority
              )}`}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BoardPage() {
  const { id } = useParams<{ id: string }>();
  const {
    board,
    createColumn,
    updateBoard,
    columns,
    createRealTask,
    setColumns,
    moveTask,
    updateColumn,
    updateTask,
    deleteTask,
  } = useBoard(id);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newColor, setNewColor] = useState("");

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isCreatingColumn, setIsCreatingColumn] = useState(false);
  const [isEditingColumn, setIsEditingColumn] = useState(false);

  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [editingColumnTitle, setEditingColumnTitle] = useState("");
  const [editingColumn, setEditingColumn] = useState<ColumnWithTasks | null>(
    null
  );

  const [isEditingTask, setIsEditingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    assignee: "",
    dueDate: "",
    priority: "medium",
  });

  const [filters, setFilters] = useState({
    priority: [] as string[],
    assignee: [] as string[],
    dueDate: null as string | null,
  });

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const [undo, setUndo] = useState<UndoState>(null);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(0);
  const undoRef = useRef<UndoState>(null);
  useEffect(() => {
    undoRef.current = undo;
    return () => {
      if (undoRef.current?.timer) window.clearTimeout(undoRef.current.timer);
    };
  }, [undo]);

  useEffect(() => {
    if (!undo) return;
    setUndoSecondsLeft(
      Math.max(0, Math.ceil((undo.expiresAt - Date.now()) / 1000))
    );

    const id = window.setInterval(() => {
      const current = undoRef.current;
      if (!current) {
        window.clearInterval(id);
        return;
      }
      const msLeft = current.expiresAt - Date.now();
      setUndoSecondsLeft(Math.max(0, Math.ceil(msLeft / 1000)));

      if (msLeft <= 0) {
        if (current.timer) window.clearTimeout(current.timer);
        window.clearInterval(id);
        setUndo(null);
      }
    }, 250);

    return () => window.clearInterval(id);
  }, [undo?.expiresAt]);

  const isFilterActive = Boolean(
    filters.priority.length || filters.assignee.length || filters.dueDate
  );
  const matchesFilters = (task: Task): boolean => {
    if (filters.priority.length && !filters.priority.includes(task.priority))
      return false;
    if (
      filters.assignee.length &&
      !filters.assignee.includes(task.assignee || "")
    )
      return false;
    if (filters.dueDate && task.due_date !== filters.dueDate) return false;
    return true;
  };

  const totalCount = isFilterActive
    ? columns.reduce((sum, c) => sum + c.tasks.filter(matchesFilters).length, 0)
    : columns.reduce((sum, c) => sum + c.tasks.length, 0);

  const activeFilterCount =
    filters.priority.length +
    filters.assignee.length +
    (filters.dueDate ? 1 : 0);

  function handleFilterChange(
    type: "priority" | "assignee" | "dueDate",
    value: string | string[] | null
  ) {
    setFilters((prev) => ({ ...prev, [type]: value }));
  }

  async function handleUpdateBoard(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !board) return;
    try {
      await updateBoard(board.id, {
        title: newTitle.trim(),
        color: newColor || board.color,
      });
      setIsEditingTitle(false);
    } catch {}
  }

  const makeHandleCreateTask =
    (columnId: string) => async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      const taskData = {
        title: (formData.get("title") as string) ?? "",
        description:
          ((formData.get("description") as string) || "").trim() || undefined,
        assignee:
          ((formData.get("assignee") as string) || "").trim() || undefined,
        dueDate: (formData.get("dueDate") as string) || undefined,
        priority: ((formData.get("priority") as string) || "medium") as
          | "low"
          | "medium"
          | "high",
      };
      if (!taskData.title.trim()) return;
      await createRealTask(columnId, taskData);
      (
        document.querySelector('[data-state="open"]') as HTMLElement | null
      )?.click();
    };

  async function handleCreateTaskGlobal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const taskData = {
      title: (formData.get("title") as string) ?? "",
      description:
        ((formData.get("description") as string) || "").trim() || undefined,
      assignee:
        ((formData.get("assignee") as string) || "").trim() || undefined,
      dueDate: (formData.get("dueDate") as string) || undefined,
      priority: ((formData.get("priority") as string) || "medium") as
        | "low"
        | "medium"
        | "high",
    };
    if (!taskData.title.trim()) return;
    const target = columns[0];
    if (!target) throw new Error("No column available to add task");
    await createRealTask(target.id, taskData);
    (
      document.querySelector('[data-state="open"]') as HTMLElement | null
    )?.click();
  }

  function handleDragStart(event: DragStartEvent) {
    const taskId = event.active.id as string;
    const task = columns.flatMap((c) => c.tasks).find((t) => t.id === taskId);
    if (task) setActiveTask(task);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const sourceColumn = columns.find((col) =>
      col.tasks.some((t) => t.id === activeId)
    );
    const targetColumn = columns.find((col) =>
      col.tasks.some((t) => t.id === overId)
    );

    if (!sourceColumn || !targetColumn) return;

    if (sourceColumn.id === targetColumn.id) {
      const activeIndex = sourceColumn.tasks.findIndex(
        (t) => t.id === activeId
      );
      const overIndex = targetColumn.tasks.findIndex((t) => t.id === overId);
      if (activeIndex !== overIndex) {
        setColumns((prev) => {
          const next = prev.map((c) => ({ ...c, tasks: [...c.tasks] }));
          const col = next.find((c) => c.id === sourceColumn.id);
          if (col) {
            const tasks = [...col.tasks];
            const [removed] = tasks.splice(activeIndex, 1);
            tasks.splice(overIndex, 0, removed);
            col.tasks = tasks;
          }
          return next;
        });
      }
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    const columnTarget = columns.find((col) => col.id === overId);
    if (columnTarget) {
      const sourceColumn = columns.find((col) =>
        col.tasks.some((t) => t.id === taskId)
      );
      if (sourceColumn && sourceColumn.id !== columnTarget.id) {
        await moveTask(taskId, columnTarget.id, columnTarget.tasks.length);
      }
    } else {
      const sourceColumn = columns.find((col) =>
        col.tasks.some((t) => t.id === taskId)
      );
      const targetColumn = columns.find((col) =>
        col.tasks.some((t) => t.id === overId)
      );
      if (sourceColumn && targetColumn) {
        const oldIndex = sourceColumn.tasks.findIndex((t) => t.id === taskId);
        const newIndex = targetColumn.tasks.findIndex((t) => t.id === overId);
        if (oldIndex !== newIndex) {
          await moveTask(taskId, targetColumn.id, newIndex);
        }
      }
    }
    setActiveTask(null);
  }

  async function handleCreateColumn(e: React.FormEvent) {
    e.preventDefault();
    if (!newColumnTitle.trim()) return;
    await createColumn(newColumnTitle.trim());
    setNewColumnTitle("");
    setIsCreatingColumn(false);
  }

  async function handleUpdateColumn(e: React.FormEvent) {
    e.preventDefault();
    if (!editingColumnTitle.trim() || !editingColumn) return;
    await updateColumn(editingColumn.id, editingColumnTitle.trim());
    setEditingColumnTitle("");
    setIsEditingColumn(false);
    setEditingColumn(null);
  }

  function handleEditColumn(column: ColumnWithTasks) {
    setIsEditingColumn(true);
    setEditingColumn(column);
    setEditingColumnTitle(column.title);
  }

  return (
    <>
      <div className="min-h-screen bg-background">
        <Navbar
          boardTitle={board?.title}
          onEditBoard={() => {
            setNewTitle(board?.title ?? "");
            setNewColor(board?.color ?? "");
            setIsEditingTitle(true);
          }}
          onFilterClick={() => setIsFilterOpen(true)}
          filterCount={activeFilterCount}
        />

        {/* Edit Board Dialog */}
        <Dialog open={isEditingTitle} onOpenChange={setIsEditingTitle}>
          <DialogContent className="w-[95vw] max-w-[425px] mx-auto">
            <DialogHeader>
              <DialogTitle>Edit Board</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleUpdateBoard}>
              <div className="space-y-2">
                <Label htmlFor="boardTitle">Board Title</Label>
                <Input
                  id="boardTitle"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Enter board title...."
                  required
                  className="focus-brand"
                />
              </div>

              {/* color picker unchanged */}

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditingTitle(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Filter Dialog */}
        <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <DialogContent className="w-[95vw] max-w-[425px] mx-auto">
            <DialogHeader>
              <DialogTitle>Filter Tasks</DialogTitle>
              <p className="text-sm text-gray-600 dark:text-muted-foreground">
                Filter task by priority, assignee, or due date
              </p>
            </DialogHeader>
            <div className="space-y-4">
              {/* Priority + assignee unchanged */}
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={filters.dueDate ?? ""}
                  onChange={(e) =>
                    handleFilterChange("dueDate", e.target.value || null)
                  }
                  className="focus-brand"
                />
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setFilters({ priority: [], assignee: [], dueDate: null })
                  }
                >
                  Clear Filter
                </Button>
                <Button type="button" onClick={() => setIsFilterOpen(false)}>
                  Apply Filters
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Board Content */}
        <main className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
          {/* Stats */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-4 sm:space-y-0">
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <div className="text-sm text-gray-600 dark:text-muted-foreground">
                <span className="font-medium">Total Task: </span>
                {totalCount}
              </div>
            </div>

            {/* Global Add Task */}
            <Dialog>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus />
                  Add Task
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-[425px] mx-auto">
                <DialogHeader>
                  <DialogTitle>Create New Task</DialogTitle>
                  <p className="text-sm text-gray-600 dark:text-muted-foreground">
                    Add a task to the first column
                  </p>
                </DialogHeader>

                <form className="space-y-4" onSubmit={handleCreateTaskGlobal}>
                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input
                      id="title"
                      name="title"
                      placeholder="Enter task title"
                      required
                      className="focus-brand"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      placeholder="Enter task description"
                      rows={3}
                      className="focus-brand"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Assignee</Label>
                    <Input
                      id="assignee"
                      name="assignee"
                      placeholder="Who should do this?"
                      className="focus-brand"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select name="priority" defaultValue="medium">
                      <SelectTrigger className="focus-brand">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["low", "medium", "high"].map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            {priority.charAt(0).toUpperCase() +
                              priority.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input
                      type="date"
                      id="dueDate"
                      name="dueDate"
                      className="focus-brand"
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="submit">Create Task</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Columns */}
          <DndContext
            sensors={sensors}
            collisionDetection={rectIntersection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div
              className="flex flex-col lg:flex-row 
              lg:space-x-6 lg:overflow-x-auto 
              lg:pb-6 lg:px-2 lg:-mx-2 lg:[&::-webkit-scrollbar]:h-2 
              lg:[&::-webkit-scrollbar-track]:bg-gray-100 dark:lg:[&::-webkit-scrollbar-track]:bg-muted 
              lg:[&::-webkit-scrollbar-thumb]:bg-gray-300 dark:lg:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30
              lg:[&::-webkit-scrollbar-thumb]:rounded-full 
              space-y-4 lg:space-y-0"
            >
              {columns.map((column) => {
                const visibleTasks = isFilterActive
                  ? column.tasks.filter(matchesFilters)
                  : column.tasks;
                const badgeCount = isFilterActive
                  ? visibleTasks.length
                  : column.tasks.length;

                return (
                  <DroppableColumn
                    key={column.id}
                    column={column}
                    onCreateTask={makeHandleCreateTask(column.id)}
                    onEditColumn={handleEditColumn}
                    countToShow={badgeCount}
                  >
                    <SortableContext
                      items={column.tasks.map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-3">
                        {visibleTasks.map((task) => (
                          <SortableTask
                            task={task}
                            key={task.id}
                            onClick={() => {
                              setEditingTask(task);
                              setTaskForm({
                                title: task.title,
                                description: task.description || "",
                                assignee: task.assignee || "",
                                dueDate: task.due_date || "",
                                priority: task.priority || "medium",
                              });
                              setIsEditingTask(true);
                            }}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DroppableColumn>
                );
              })}

              {/* Add another list button */}
              <div className="w-full lg:flex-shrink-0 lg:w-80">
                <Button
                  variant="outline"
                  className="w-full h-full min-h-[200px] border-dashed border-2 text-muted-foreground transition-colors hover:border-blue-600 hover:text-blue-600"
                  onClick={() => setIsCreatingColumn(true)}
                >
                  <Plus />
                  Add another list
                </Button>
              </div>

              <DragOverlay>
                {activeTask ? <TaskOverlay task={activeTask} /> : null}
              </DragOverlay>
            </div>
          </DndContext>
        </main>
      </div>

      {/* Create Column */}
      <Dialog open={isCreatingColumn} onOpenChange={setIsCreatingColumn}>
        <DialogContent className="w-[95vw] max-w-[425px] mx-auto">
          <DialogHeader>
            <DialogTitle>Create New Column</DialogTitle>
            <p className="text-sm text-gray-600 dark:text-muted-foreground">
              Add new column to organize your tasks
            </p>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreateColumn}>
            <div className="space-y-2">
              <Label>Column title</Label>
              <Input
                id="columnTitle"
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                placeholder="Enter column title..."
                required
                className="focus-brand"
              />
            </div>
            <div className="space-x-2 flex justify-end">
              <Button
                type="button"
                onClick={() => setIsCreatingColumn(false)}
                variant="outline"
              >
                Cancel
              </Button>
              <Button type="submit">Create Column</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Column */}
      <Dialog open={isEditingColumn} onOpenChange={setIsEditingColumn}>
        <DialogContent className="w-[95vw] max-w-[425px] mx-auto">
          <DialogHeader>
            <DialogTitle>Edit Column</DialogTitle>
            <p className="text-sm text-gray-600 dark:text-muted-foreground">
              Update the title of your column
            </p>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleUpdateColumn}>
            <div className="space-y-2">
              <Label>Column title</Label>
              <Input
                id="columnTitle"
                value={editingColumnTitle}
                onChange={(e) => setEditingColumnTitle(e.target.value)}
                placeholder="Enter column title..."
                required
                className="focus-brand"
              />
            </div>
            <div className="space-x-2 flex justify-end">
              <Button
                type="button"
                onClick={() => {
                  setIsEditingColumn(false);
                  setEditingColumnTitle("");
                  setEditingColumn(null);
                }}
                variant="outline"
              >
                Cancel
              </Button>
              <Button type="submit">Edit Column</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Task (with Delete + Undo) */}
      <Dialog
        open={isEditingTask}
        onOpenChange={(open) => {
          setIsEditingTask(open);
          if (!open) setEditingTask(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!editingTask) return;
              await updateTask(editingTask.id, {
                title: taskForm.title,
                description: taskForm.description,
                assignee: taskForm.assignee,
                due_date: taskForm.dueDate,
                priority: taskForm.priority as "low" | "medium" | "high",
              });
              setIsEditingTask(false);
              setEditingTask(null);
            }}
          >
            <div>
              <Label>Title</Label>
              <Input
                value={taskForm.title}
                onChange={(e) =>
                  setTaskForm((f) => ({ ...f, title: e.target.value }))
                }
                required
                className="focus-brand"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={taskForm.description}
                onChange={(e) =>
                  setTaskForm((f) => ({ ...f, description: e.target.value }))
                }
                className="focus-brand"
              />
            </div>
            <div>
              <Label>Assignee</Label>
              <Input
                value={taskForm.assignee}
                onChange={(e) =>
                  setTaskForm((f) => ({ ...f, assignee: e.target.value }))
                }
                className="focus-brand"
              />
            </div>
            <div>
              <Label>Priority</Label>
              <Select
                value={taskForm.priority}
                onValueChange={(val) =>
                  setTaskForm((f) => ({ ...f, priority: val }))
                }
              >
                <SelectTrigger className="focus-brand">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["low", "medium", "high"].map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {priority.charAt(0).toUpperCase() + priority.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Due Date</Label>
              <Input
                type="date"
                value={taskForm.dueDate}
                onChange={(e) =>
                  setTaskForm((f) => ({ ...f, dueDate: e.target.value }))
                }
                className="focus-brand"
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button
                type="button"
                variant="destructive"
                onClick={async () => {
                  if (!editingTask) return;
                  const ok = window.confirm(
                    "Delete this task? This action cannot be undone."
                  );
                  if (!ok) return;

                  const snapshot = await deleteTask(editingTask.id);
                  setIsEditingTask(false);
                  setEditingTask(null);

                  if (snapshot) {
                    if (undoRef.current?.timer)
                      window.clearTimeout(undoRef.current.timer);
                    const expiresAt = Date.now() + UNDO_MS;
                    const timer = window.setTimeout(
                      () => setUndo(null),
                      UNDO_MS
                    );

                    setUndo({
                      task: snapshot.task,
                      columnId: snapshot.columnId,
                      timer,
                      expiresAt,
                    });
                  }
                }}
              >
                Delete Task
              </Button>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditingTask(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Undo bar */}
      {undo && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <Card className="shadow-lg">
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <span className="text-sm">Task deleted.</span>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const snap = undoRef.current;
                  if (!snap) return;

                  await createRealTask(snap.columnId, {
                    title: snap.task.title,
                    description: snap.task.description || undefined,
                    assignee: snap.task.assignee || undefined,
                    dueDate: snap.task.due_date || undefined,
                    priority:
                      (snap.task.priority as "low" | "medium" | "high") ||
                      "medium",
                  });
                  if (snap.timer) window.clearTimeout(snap.timer);
                  setUndo(null);
                }}
              >
                Undo ({undoSecondsLeft})
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
