import path from "node:path";

export function jobFolder(id:string, company:string,title:string){ return path.join("jobs",`${id}_${`${company}_${title}`.replace(/[^a-z0-9]+/gi,"_").replace(/^_|_$/g,"").slice(0,80)}`); }
