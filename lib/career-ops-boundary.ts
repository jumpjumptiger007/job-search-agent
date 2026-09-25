import fs from "node:fs";
import path from "node:path";

export const forbiddenCareerOpsState = ["data/applications.md", "data/pipeline.md", "data/scan-history.tsv", "reports", "data/applications.db"];

export function assertNoCareerOpsCanonicalState(root = process.cwd()) {
  const found = forbiddenCareerOpsState.filter((relativePath) => fs.existsSync(path.join(root, relativePath)));
  if (found.length) throw new Error(`Career Ops canonical state is forbidden: ${found.join(", ")}`);
}
