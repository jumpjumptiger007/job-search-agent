import type { NormalizedJob } from "../../types";

const endpoint = "https://www.arbeitnow.com/api/job-board-api";
const maxPages = 3;
const entityNames: Record<string, string> = {
  amp: "&", apos: "'", bull: "•", copy: "©", euro: "€", gt: ">", ldquo: "“", lsquo: "‘",
  lt: "<", mdash: "—", nbsp: " ", ndash: "–", quot: '"', rdquo: "”", rsquo: "’"
};

export type ArbeitnowFetcher = typeof fetch;

type JobRecord = Record<string, unknown>;

const asRecord = (value: unknown): JobRecord | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as JobRecord : undefined;
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

function decodeEntities(value: string) {
  return value.replace(/&(#(?:x[\da-f]+|\d+)|[a-z][a-z\d]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const codePoint = Number.parseInt(entity[1]?.toLowerCase() === "x" ? entity.slice(2) : entity.slice(1), entity[1]?.toLowerCase() === "x" ? 16 : 10);
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
    }
    return entityNames[entity.toLowerCase()] ?? match;
  });
}

function plainText(value: string) {
  let decoded = value;
  for (let i = 0; i < 2; i++) decoded = decodeEntities(decoded);
  return decoded
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function directJobUrl(value: unknown) {
  try {
    const url = new URL(text(value));
    if (url.protocol !== "https:" || !url.hostname || url.pathname === "/" || url.username || url.password) return undefined;
    url.hash = "";
    return url.href;
  } catch {
    return undefined;
  }
}

function postedAt(value: unknown) {
  const raw = typeof value === "number" ? value : /^\d+$/.test(text(value)) ? Number(text(value)) : undefined;
  const milliseconds = raw === undefined ? Date.parse(text(value)) : Math.abs(raw) < 100_000_000_000 ? raw * 1000 : raw;
  if (!Number.isFinite(milliseconds) || Math.abs(milliseconds) > 8.64e15) return undefined;
  try { return new Date(milliseconds).toISOString(); }
  catch { return undefined; }
}

function normalizeJob(value: unknown): NormalizedJob | undefined {
  const row = asRecord(value), company = text(row?.company_name), title = text(row?.title), url = directJobUrl(row?.url);
  if (!company || !title || !url) return undefined;

  const slug = text(row?.slug), description = plainText(text(row?.description));
  const externalId = /^[a-z0-9][a-z0-9._-]{0,199}$/i.test(slug) ? `arbeitnow:${slug}` : `arbeitnow:${url}`;
  const normalizedTitle = title.toLowerCase().replace(/\s+/g, " ").trim();
  const normalizedDescription = description.toLowerCase().replace(/\s+/g, " ").trim();
  const date = postedAt(row?.created_at);
  const location = text(row?.location);

  return {
    sourceName: "Arbeitnow",
    externalId,
    company,
    title,
    ...(location ? { location } : {}),
    url,
    description,
    contentStatus: description.length >= 80 && normalizedDescription !== normalizedTitle ? "SUBSTANTIVE" : "INSUFFICIENT",
    ...(date ? { postedAt: date } : {}),
    ...(row?.remote === true ? { workModel: "remote" } : {}),
    discoveredVia: "Arbeitnow public API"
  };
}

function nextPage(value: unknown, current: URL) {
  try {
    const next = new URL(text(value), current);
    if (next.protocol !== "https:" || next.origin !== current.origin || next.pathname !== current.pathname) return undefined;
    const page = next.searchParams.get("page");
    if (!page || !/^\d+$/.test(page)) return undefined;
    next.hash = "";
    return next;
  } catch {
    return undefined;
  }
}

export class ArbeitnowAdapter {
  name = "Arbeitnow";

  constructor(private limit: number, private fetcher: ArbeitnowFetcher = globalThis.fetch) {}

  async discover(): Promise<NormalizedJob[]> {
    if (!Number.isInteger(this.limit) || this.limit <= 0) return [];

    const jobs: NormalizedJob[] = [], identities = new Set<string>(), pages = new Set<string>();
    let current = new URL(endpoint), scanned = 0;
    for (let page = 0; page < maxPages && scanned < this.limit && jobs.length < this.limit; page++) {
      if (pages.has(current.href)) break;
      pages.add(current.href);

      const response = await this.fetcher(current.href, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = asRecord(await response.json());
      if (!payload || !Array.isArray(payload.data)) throw new Error("Arbeitnow returned invalid JSON data");

      for (const candidate of payload.data) {
        if (scanned >= this.limit || jobs.length >= this.limit) break;
        scanned++;
        const job = normalizeJob(candidate);
        if (!job?.externalId || identities.has(job.externalId)) continue;
        identities.add(job.externalId);
        jobs.push(job);
      }

      if (scanned >= this.limit || jobs.length >= this.limit) break;
      const links = asRecord(payload.links), next = nextPage(links?.next, current);
      if (!next || pages.has(next.href)) break;
      current = next;
    }
    return jobs;
  }
}
