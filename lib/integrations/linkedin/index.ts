import { execFile } from "node:child_process";
import path from "node:path";
import type { DiscoveryPreferences, NormalizedJob } from "../../types";
import { getProjectRoot, resolveProjectPath } from "../../project-root";

export type LinkedInRunner = (args: string[]) => Promise<string>;

export const linkedinCliPath = () => resolveProjectPath(".agents/skills/linkedin-search/cli/src/cli.ts");

export const runLinkedInCli: LinkedInRunner = args => new Promise((resolve, reject) => {
  const root = getProjectRoot(), cli = linkedinCliPath();
  execFile("bun", ["run", cli, ...args], { cwd: root, timeout: 90000, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) reject(new Error(error.message.includes("ENOENT") ? "Bun is required for optional LinkedIn discovery" : `LinkedIn CLI: ${stderr.trim() || error.message}`));
    else resolve(stdout);
  });
});

type Card = { id?: unknown; title?: unknown; company?: unknown; location?: unknown; date?: unknown };
type Detail = Card & { description?: unknown };
const value = (input: unknown) => typeof input === "string" ? input.trim() : "";
const idOf = (input: unknown) => typeof input === "string" && /^\d{6,}$/.test(input) ? input : null;
const dateOf = (input: unknown) => { const date = value(input); return date && Number.isFinite(Date.parse(date)) ? new Date(date).toISOString() : undefined; };
const ageWindow = (days?: number) => !Number.isFinite(days) || !days || days <= 0 || days > 30 ? undefined : [1, 7, 14, 30].find(window => window >= days);
const remoteMode = (preference?: string) => ({ remote: "remote", hybrid: "hybrid", onsite: "onsite", "on-site": "onsite" })[preference?.toLowerCase() as "remote"];

export class LinkedInAdapter {
  name = "LinkedIn";
  constructor(private preferences: DiscoveryPreferences, private limit: number, private runner: LinkedInRunner = runLinkedInCli) {}

  async discover(): Promise<NormalizedJob[]> {
    const roles = [...new Set((this.preferences.roleFamilies || []).map(value).filter(Boolean))].slice(0, 5);
    if (!roles.length || this.limit <= 0) return [];
    const jobs: NormalizedJob[] = [], seen = new Set<string>();
    const location = value(this.preferences.location) || "Germany";
    const mode = remoteMode(this.preferences.remotePreference);
    const age = ageWindow(this.preferences.postingAgeDays);
    for (const role of roles) {
      if (jobs.length >= this.limit) break;
      const args = ["search", "--query", role, "--location", location, "--page", "1", "--limit", String(Math.min(this.limit - jobs.length, 10)), "--format", "json"];
      if (mode) args.push("--remote", mode);
      if (age) args.push("--jobage", String(age));
      const output = JSON.parse(await this.runner(args));
      if (!Array.isArray(output?.results)) throw new Error("LinkedIn search returned invalid JSON results");
      for (const card of output.results.slice(0, Math.min(this.limit - jobs.length, 10)) as Card[]) {
        const id = idOf(card?.id);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        let detail: Detail = {};
        try {
          const parsed = JSON.parse(await this.runner(["detail", id, "--format", "json"]));
          if (idOf(parsed?.id) === id) detail = parsed;
        } catch { /* A usable search card may still enter Review as insufficient. */ }
        const detailTitle = value(detail.title);
        const title = detailTitle && detailTitle !== "(untitled)" ? detailTitle : value(card.title), company = value(detail.company) || value(card.company);
        if (!title || !company) continue;
        const description = value(detail.description);
        jobs.push({ sourceName: "LinkedIn", externalId: `linkedin:${id}`, url: `https://www.linkedin.com/jobs/view/${id}`, company, title,
          location: value(detail.location) || value(card.location) || undefined, description,
          contentStatus: description.length >= 80 && description.toLowerCase() !== title.toLowerCase() ? "SUBSTANTIVE" : "INSUFFICIENT",
          postedAt: dateOf(card.date), discoveredVia: "LinkedIn public jobs",
          ...(mode ? { workModel: this.preferences.remotePreference } : {}) });
      }
    }
    return jobs;
  }
}
