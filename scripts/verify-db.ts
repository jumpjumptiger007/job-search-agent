import path from "node:path";
import { verifyDbIntegrity } from "../lib/db-integrity";

const dbPath = path.resolve(process.argv[2] || path.join(process.cwd(), "data", "job-agent.db"));
const report = verifyDbIntegrity(dbPath);
if (report.valid) console.log(`DB integrity: OK (${dbPath})`);
else {
  console.error(`DB integrity: FAILED (${dbPath})`);
  for (const [check, values] of Object.entries(report.violations)) if (values.length) console.error(`${check}: ${values.join(", ")}`);
  process.exitCode = 1;
}
