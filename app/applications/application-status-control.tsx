"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { applicationStates } from "@/lib/core/job-workflow";
import type { ApplicationStatus } from "@/lib/types";

export default function ApplicationStatusControl({ jobId, initialStatus }: { jobId: string; initialStatus: ApplicationStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState<ApplicationStatus>(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(next: ApplicationStatus) {
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.set("status", next);
    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/application`, { method: "POST", headers: { accept: "application/json" }, body });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || "Application status could not be updated.");
      setStatus(next);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Application status could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="application-status-control"><label className="sr-only" htmlFor={`application-${jobId}`}>Application status for {jobId}</label><select id={`application-${jobId}`} value={status} disabled={busy} onChange={(event) => void update(event.target.value as ApplicationStatus)}>
    {applicationStates.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
  </select>{busy && <small role="status">Saving…</small>}{error && <small className="is-error" role="alert">{error}</small>}</div>;
}
