import type { NormalizedJob } from "../../types";
import type { CareerOpsProvider, CareerOpsProviderJob } from "./providers";

export type AdaptedCareerOpsJob = { job:NormalizedJob; provider:{id:string; dedupKey?:string} };

export function adaptCareerOpsJob(source:CareerOpsProviderJob, provider:CareerOpsProvider, sourceName:string):AdaptedCareerOpsJob {
  if (!sourceName.trim()) throw new Error("Career Ops normalization requires an explicit source name");
  for (const field of ["title","url","company"] as const) if (typeof source[field] !== "string") throw new Error(`Career Ops job is missing ${field}`);
  if (source.location !== undefined && typeof source.location !== "string") throw new Error("Career Ops job has invalid location");
  if (source.description !== undefined && typeof source.description !== "string") throw new Error("Career Ops job has invalid description");
  const postedAt = typeof source.postedAt === "number" && Number.isFinite(source.postedAt) && !Number.isNaN(new Date(source.postedAt).valueOf()) ? new Date(source.postedAt).toISOString() : undefined;
  const dedupKey = typeof provider.dedupKey === "function" ? provider.dedupKey(source) : null;
  return {job:{company:source.company,title:source.title,location:source.location,url:source.url,sourceName,description:source.description || "",contentStatus:source.description ? "SUBSTANTIVE" : "INSUFFICIENT",postedAt},provider:{id:provider.id,...(dedupKey ? {dedupKey} : {})}};
}
