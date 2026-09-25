import fs from "node:fs";
import path from "node:path";

const storageRoot=()=>process.env.JOB_AGENT_STORAGE_ROOT||process.cwd();
export function jobFolder(id:string, company:string,title:string){ return path.join("jobs",`${id}_${`${company}_${title}`.replace(/[^a-z0-9]+/gi,"_").replace(/^_|_$/g,"").slice(0,80)}`); }

const legacyMirrors=["job.json","jd_original.md","analysis.md"];

export function cleanupLegacyJobMirrors(){
 const root=path.join(storageRoot(),"jobs"),removedFiles:string[]=[],removedDirectories:string[]=[];
 if(!fs.existsSync(root))return {removedFiles,removedDirectories};
 for(const entry of fs.readdirSync(root,{withFileTypes:true})){
  if(!entry.isDirectory())continue;
  const directory=path.join(root,entry.name);
  for(const name of legacyMirrors){const file=path.join(directory,name);if(fs.existsSync(file)&&fs.lstatSync(file).isFile()){fs.unlinkSync(file);removedFiles.push(path.relative(storageRoot(),file));}}
  if(fs.readdirSync(directory).length===0){fs.rmdirSync(directory);removedDirectories.push(path.relative(storageRoot(),directory));}
 }
 return {removedFiles,removedDirectories};
}
