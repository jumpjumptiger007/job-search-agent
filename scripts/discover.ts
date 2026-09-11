import { runDiscovery } from "../lib/discovery";
runDiscovery(process.argv[2]||"config/search.yaml").then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e);process.exit(1)});
