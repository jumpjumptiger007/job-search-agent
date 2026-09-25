import Database from "better-sqlite3";

export type DbIntegrityReport = { valid: boolean; violations: Record<string, string[]> };

const rows = (db: Database.Database, sql: string) => (db.prepare(sql).all() as { value: string | null }[]).map((row) => row.value ?? "<null>");

export function verifyDbIntegrity(dbPath: string): DbIntegrityReport {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const violations = {
      canonicalSource: rows(db, "SELECT j.job_id AS value FROM jobs j LEFT JOIN job_sources s ON s.job_id=j.id AND s.url=j.canonical_url AND s.is_canonical=1 WHERE s.id IS NULL"),
      canonicalSourceIdentity: rows(db, "SELECT j.job_id AS value FROM jobs j JOIN job_sources s ON s.job_id=j.id AND s.url=j.canonical_url AND s.is_canonical=1 WHERE s.source_name IS NULL OR j.canonical_source IS NULL OR s.source_name<>j.canonical_source"),
      canonicalSourceCount: rows(db, "SELECT j.job_id AS value FROM jobs j LEFT JOIN job_sources s ON s.job_id=j.id AND s.is_canonical=1 GROUP BY j.id HAVING COUNT(s.id)<>1"),
      orphanSource: rows(db, "SELECT CAST(s.id AS TEXT) AS value FROM job_sources s LEFT JOIN jobs j ON j.id=s.job_id WHERE j.id IS NULL"),
      invalidJobId: rows(db, "SELECT job_id AS value FROM jobs WHERE job_id IS NULL OR job_id NOT GLOB 'JOB-[0-9]*' OR job_id GLOB 'JOB-*[^0-9]*'"),
      duplicateJobId: rows(db, "SELECT job_id AS value FROM jobs GROUP BY job_id HAVING job_id IS NULL OR COUNT(*)<>1"),
      invalidReviewState: rows(db, "SELECT job_id AS value FROM jobs WHERE review_status IS NULL OR review_status NOT IN ('PENDING','INTERESTED','SKIPPED')"),
      invalidApplicationState: rows(db, "SELECT job_id AS value FROM jobs WHERE application_status IS NULL OR application_status NOT IN ('NOT_APPLIED','READY_TO_APPLY','APPLIED','INTERVIEW','REJECTED','OFFER','WITHDRAWN')"),
    };
    return { valid: Object.values(violations).every((values) => values.length === 0), violations };
  } finally { db.close(); }
}
