import { listJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export default function Page() {
  const count = listJobs().length;
  return <main className="exports-page"><section className="page-intro"><div><h2>Exports</h2><p>Download the current operational job data for local use.</p></div><span>{count} {count === 1 ? "job" : "jobs"}</span></section>
    <section className="export-list"><div className="export-row"><div><h3>CSV spreadsheet</h3><p>Comma-separated values for spreadsheet tools and data workflows.</p></div><a className="primary-link" href="/api/export?format=csv" download>Download CSV</a></div><div className="export-row"><div><h3>Excel workbook</h3><p>Formatted as an .xlsx workbook with the same stored job fields.</p></div><a className="primary-link" href="/api/export?format=xlsx" download>Download XLSX</a></div><p className="export-note">Exports use the existing canonical 1–5 evaluation score and current stored job state.</p></section>
  </main>;
}
