import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AiBuilder } from "@/components/AiBuilder";

export const dynamic = "force-dynamic";

export default async function AiCreatePage() {
  if (!(await getCurrentUser())) redirect("/login");
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Criar com IA</h1>
          <p className="text-sm text-slate-500">Descreva o que quer automatizar. A IA monta o fluxo.</p>
        </div>
        <Link href="/create" className="btn-ghost">
          ← Voltar
        </Link>
      </div>
      <AiBuilder />
    </div>
  );
}
