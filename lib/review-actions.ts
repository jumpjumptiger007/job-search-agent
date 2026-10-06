type ReviewAction = "INTERESTED" | "SKIPPED";

export async function saveReviewStatus(jobId: string, status: ReviewAction, request: typeof fetch = fetch) {
  const body = new FormData();
  body.set("status", status);
  const response = await request(`/api/jobs/${encodeURIComponent(jobId)}/review`, {
    method: "POST",
    headers: { accept: "application/json" },
    body,
  });
  const result = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(result?.error || "Review status could not be updated.");
}

export async function saveReviewStatuses(
  jobIds: string[],
  status: ReviewAction,
  save: (jobId: string, status: ReviewAction) => Promise<void> = saveReviewStatus,
) {
  const results = await Promise.all(jobIds.map(async (jobId) => {
    try {
      await save(jobId, status);
      return { jobId, ok: true as const };
    } catch (error) {
      return { jobId, ok: false as const, message: error instanceof Error ? error.message : "Request failed" };
    }
  }));
  return { succeeded: results.filter((result) => result.ok).map((result) => result.jobId), failed: results.filter((result) => !result.ok) };
}
