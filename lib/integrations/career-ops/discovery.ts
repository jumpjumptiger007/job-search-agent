import type { DiscoveredJob } from "../../types";
import path from "node:path";
import { adaptCareerOpsJob } from "./normalize";
import { loadCareerOpsProvider,loadCareerOpsTransport,type CareerOpsTransport } from "./providers";

const greenhouseJobId = (url:string, board:string) => {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return parts[0] === board && parts[1] === "jobs" && /^\d+$/.test(parts[2] || "") ? parts[2] : undefined;
  } catch { return undefined; }
};

/** Runs the pinned Greenhouse provider while retaining this application's identity rules. */
export async function discoverGreenhouse(board:string, limit?:number, transport?:CareerOpsTransport):Promise<DiscoveredJob[]> {
  const projectRoot = path.resolve(__dirname,"../../..");
  const provider = await loadCareerOpsProvider("greenhouse",projectRoot);
  const rows = await provider.fetch({name:board,api:`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs`},transport || await loadCareerOpsTransport(projectRoot));
  return rows.slice(0,limit).map(source => {
    const {job} = adaptCareerOpsJob(source,provider,"Greenhouse");
    const id = greenhouseJobId(job.url,board);
    return {...job,ats:"Greenhouse",...(id ? {externalId:`greenhouse:${board}:${id}`} : {}),discoveredVia:"configured ATS"};
  });
}
