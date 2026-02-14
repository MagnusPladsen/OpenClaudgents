import { useState, useEffect } from "react";
import { getClaudeTodos } from "../../lib/tauri";
import type { TodoItem } from "../../lib/types";

export function TaskListPanel() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");

  useEffect(() => {
    loadTodos();
    // Poll every 10 seconds for changes
    const interval = setInterval(loadTodos, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadTodos = () => {
    getClaudeTodos()
      .then((items) => {
        setTodos(items);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  };

  const filtered = todos.filter((t) => {
    if (filter === "pending") return t.status !== "done";
    if (filter === "done") return t.status === "done";
    return true;
  });

  const pendingCount = todos.filter((t) => t.status === "pending").length;
  const inProgressCount = todos.filter((t) => t.status === "in_progress").length;
  const doneCount = todos.filter((t) => t.status === "done").length;

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-text">Tasks</h3>
        <div className="flex items-center gap-1">
          {(["all", "pending", "done"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-2 py-0.5 text-xs transition-colors ${
                filter === f
                  ? "bg-bg-tertiary text-text"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {f === "all" ? `All (${todos.length})` : f === "pending" ? `Active (${pendingCount + inProgressCount})` : `Done (${doneCount})`}
            </button>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      {todos.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-xs text-text-muted">
            <span>{doneCount}/{todos.length} complete</span>
            <span>{Math.round((doneCount / todos.length) * 100)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-tertiary">
            <div
              className="h-full rounded-full bg-success transition-all"
              style={{ width: `${(doneCount / todos.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-6 text-center text-xs text-text-muted">Loading tasks...</div>
      ) : filtered.length === 0 ? (
        <div className="py-6 text-center text-xs text-text-muted">
          {todos.length === 0
            ? "No tasks found in ~/.claude/todos/ or ~/.claude/tasks/"
            : "No matching tasks"}
        </div>
      ) : (
        <ul className="space-y-1">
          {filtered.map((todo) => (
            <li
              key={todo.id}
              className="flex items-start gap-2 rounded px-2 py-1.5 hover:bg-bg-tertiary"
            >
              <StatusIcon status={todo.status} />
              <div className="min-w-0 flex-1">
                <div
                  className={`text-xs ${
                    todo.status === "done"
                      ? "text-text-muted line-through"
                      : "text-text"
                  }`}
                >
                  {todo.content}
                </div>
                {todo.status === "in_progress" && (
                  <span className="text-xs text-accent">In progress</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "done") {
    return (
      <svg className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-success" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16Zm3.78-9.72a.75.75 0 0 0-1.06-1.06L6.75 9.19 5.28 7.72a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l4.5-4.5Z" />
      </svg>
    );
  }
  if (status === "in_progress") {
    return (
      <svg className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 animate-spin text-accent" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="8" cy="8" r="6" strokeDasharray="30 10" />
      </svg>
    );
  }
  return (
    <svg className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-text-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
    </svg>
  );
}
