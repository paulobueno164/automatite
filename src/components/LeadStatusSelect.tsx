"use client";

import { useRouter } from "next/navigation";
import { LEAD_STATUSES } from "@/lib/crm-constants";

export function LeadStatusSelect({ leadId, status }: { leadId: string; status: string }) {
  const router = useRouter();

  async function change(next: string) {
    await fetch(`/api/crm/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    router.refresh();
  }

  return (
    <select className="input w-auto text-sm" value={status} onChange={(e) => change(e.target.value)}>
      {LEAD_STATUSES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
