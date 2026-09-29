import type { DiscoveryPreferences, NormalizedJob } from "../../types";

const endpoint = "https://jobs.workable.com/api/v1/jobs";
const maxPages = 3;
const htmlEntities: Record<string, string> = {
  amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"'
};

export type WorkableFetcher = typeof fetch;

type WorkableRecord = Record<string, unknown>;

const asRecord = (value: unknown): WorkableRecord | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as WorkableRecord : undefined;
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

function decodeEntities(value: string) {
  return value.replace(/&(#(?:x[\da-f]+|\d+)|[a-z][a-z\d]+);/gi, (match, entity: string) => {
    if (entity[0] !== "#") return htmlEntities[entity.toLowerCase()] ?? match;
    const hexadecimal = entity[1]?.toLowerCase() === "x";
    const codePoint = Number.parseInt(hexadecimal ? entity.slice(2) : entity.slice(1), hexadecimal ? 16 : 10);
    return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
  });
}

function plainText(value: string) {
  let decoded = value;
  for (let i = 0; i < 2; i++) decoded = decodeEntities(decoded);
  return decoded
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function directJobUrl(value: unknown) {
  try {
    const url = new URL(text(value));
    if (url.protocol !== "https:" || url.hostname !== "jobs.workable.com" || !url.pathname.startsWith("/view/") || url.username || url.password) return undefined;
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return undefined;
  }
}

function locationText(value: unknown) {
  if (typeof value === "string") return value.trim();
  const location = asRecord(value);
  if (!location) return "";
  const direct = text(location.locationString) || text(location.location_str) || text(location.name);
  if (direct) return direct;
  const values = [
    text(location.city),
    text(location.subregion) || text(location.region),
    text(location.countryName) || text(location.country)
  ].filter(Boolean);
  return [...new Set(values)].join(", ");
}

function postedAt(value: unknown) {
  const raw = typeof value === "number" ? value : /^\d+$/.test(text(value)) ? Number(text(value)) : undefined;
  const milliseconds = raw === undefined ? Date.parse(text(value)) : Math.abs(raw) < 100_000_000_000 ? raw * 1000 : raw;
  if (!Number.isFinite(milliseconds) || Math.abs(milliseconds) > 8.64e15) return undefined;
  try { return new Date(milliseconds).toISOString(); }
  catch { return undefined; }
}

function workModel(value: unknown) {
  const normalized = text(value).toLowerCase().replace(/[ -]/g, "_");
  if (normalized === "remote") return "remote";
  if (normalized === "hybrid") return "hybrid";
  if (normalized === "on_site") return "onsite";
  return undefined;
}

function normalizeJob(value: unknown): NormalizedJob | undefined {
  const row = asRecord(value);
  const companyValue = asRecord(row?.company);
  const company = text(companyValue?.title) || text(row?.company);
  const title = text(row?.title);
  const url = directJobUrl(row?.url);
  if (!company || !title || !url) return undefined;

  const rawId = text(row?.id);
  const stableId = /^[a-z0-9._-]{1,200}$/i.test(rawId) ? rawId : undefined;
  const sections = [row?.description, row?.requirementsSection, row?.benefitsSection]
    .map(text)
    .map(plainText)
    .filter(Boolean);
  const description = [...new Set(sections)].join("\n\n");
  const normalizedTitle = title.toLowerCase().replace(/\s+/g, " ").trim();
  const normalizedDescription = description.toLowerCase().replace(/\s+/g, " ").trim();
  const location = locationText(row?.location) || locationText(Array.isArray(row?.locations) ? row.locations[0] : undefined);
  const date = postedAt(row?.created);
  const model = workModel(row?.workplace);

  return {
    sourceName: "Workable",
    externalId: stableId ? `workable:${stableId}` : `workable:${url}`,
    company,
    title,
    ...(location ? { location } : {}),
    url,
    description,
    contentStatus: description.length >= 80 && normalizedDescription !== normalizedTitle ? "SUBSTANTIVE" : "INSUFFICIENT",
    ...(date ? { postedAt: date } : {}),
    ...(model ? { workModel: model } : {}),
    discoveredVia: "Workable public search"
  };
}

export class WorkableAdapter {
  name = "Workable";

  constructor(private preferences: DiscoveryPreferences, private limit: number, private fetcher: WorkableFetcher = globalThis.fetch) {}

  async discover(): Promise<NormalizedJob[]> {
    const roles = [...new Set((this.preferences.roleFamilies || []).map(text).filter(Boolean))];
    if (!roles.length || !Number.isInteger(this.limit) || this.limit <= 0) return [];

    const location = text(this.preferences.location) || "Germany";
    const jobs: NormalizedJob[] = [];
    const identities = new Set<string>();
    let scanned = 0, pages = 0;

    for (const role of roles) {
      let pageToken: string | undefined;
      const seenTokens = new Set<string>();
      while (pages < maxPages && scanned < this.limit && jobs.length < this.limit) {
        const url = new URL(endpoint);
        url.searchParams.set("query", role);
        url.searchParams.set("location", location);
        if (pageToken) url.searchParams.set("pageToken", pageToken);

        const response = await this.fetcher(url.href, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(15_000)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = asRecord(await response.json());
        if (!payload || !Array.isArray(payload.jobs)) throw new Error("Workable returned invalid JSON jobs");
        pages++;

        for (const candidate of payload.jobs) {
          if (scanned >= this.limit || jobs.length >= this.limit) break;
          scanned++;
          const job = normalizeJob(candidate);
          if (!job?.externalId || identities.has(job.externalId)) continue;
          identities.add(job.externalId);
          jobs.push(job);
        }

        if (scanned >= this.limit || jobs.length >= this.limit) break;
        const next = text(payload.nextPageToken);
        if (!next || seenTokens.has(next)) break;
        seenTokens.add(next);
        pageToken = next;
      }
      if (pages >= maxPages || scanned >= this.limit || jobs.length >= this.limit) break;
    }

    return jobs;
  }
}
