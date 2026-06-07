import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { TaskList } from "@/components/TaskList";

export const dynamic = "force-dynamic";

export default async function TarefasPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const tasks = await prisma.internalTask.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const open = tasks.filter((t) => t.status === "open").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tarefas</h1>
        <p className="text-sm text-slate-500">
          Follow-ups e lembretes criados pelas suas automações — sem CRM externo.
          {open > 0 && <span className="ml-1 font-medium text-brand-700">{open} pendente{open > 1 ? "s" : ""}</span>}
        </p>
      </div>
      <TaskList tasks={tasks.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }))} />
    </div>
  );
}
