export function currentPageSelection(selectedIds: string[], reviewablePageIds: string[]) {
  const pageIds = new Set(reviewablePageIds);
  return selectedIds.filter((jobId) => pageIds.has(jobId));
}

export function setCurrentPageSelection(selectedIds: string[], reviewablePageIds: string[], checked: boolean) {
  const visibleSelection = currentPageSelection(selectedIds, reviewablePageIds);
  return checked
    ? [...new Set([...visibleSelection, ...reviewablePageIds])]
    : visibleSelection.filter((jobId) => !reviewablePageIds.includes(jobId));
}
