"use client";

import { useRouter } from "next/navigation";

type Task = { id: string; title: string; status: string; createdAt: string };

export function TaskList({ tasks }: { tasks: Task[] }) {
  const router = useRouter();

  async function toggle(id: string, done: boolean) {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: done ? "done" : "open" }),
    });
    router.refresh();
  }

  if (tasks.length === 0) {
    return (
      <div className="card text-center text-sm text-slate-400">
        Nenhuma tarefa ainda. Use uma automação com &quot;Criar tarefa no Automatite&quot; para começar.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const done = task.status === "done";
        return (
          <div key={task.id} className={`card flex items-center gap-3 ${done ? "opacity-60" : ""}`}>
            <input
              type="checkbox"
              checked={done}
              onChange={(e) => toggle(task.id, e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${done ? "line-through text-slate-400" : ""}`}>{task.title}</p>
              <p className="text-xs text-slate-400">{new Date(task.createdAt).toLocaleString("pt-BR")}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
