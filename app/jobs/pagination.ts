export const JOBS_PAGE_SIZE = 50;

export function paginateJobs<T>(rows: T[], rawPage?: string) {
  const pageCount = Math.ceil(rows.length / JOBS_PAGE_SIZE);
  const isPositiveInteger = typeof rawPage === "string" && /^[0-9]+$/.test(rawPage);
  const requestedPage = isPositiveInteger ? Number(rawPage) : 1;
  const safeRequestedPage = requestedPage >= 1 ? requestedPage : 1;
  const page = pageCount === 0 ? 1 : Math.min(safeRequestedPage, pageCount);
  const startIndex = (page - 1) * JOBS_PAGE_SIZE;

  return {
    rows: rows.slice(startIndex, startIndex + JOBS_PAGE_SIZE),
    total: rows.length,
    page,
    pageCount,
  };
}

export function jobsPageHref(filter: string, query: string, page: number) {
  const params = new URLSearchParams();
  params.set("filter", filter);
  if (query) params.set("q", query);
  params.set("page", String(page));
  return `/jobs?${params.toString()}`;
}
