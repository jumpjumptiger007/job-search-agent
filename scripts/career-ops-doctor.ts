import { careerOpsDoctor } from "../lib/integrations/career-ops/doctor";

const result = careerOpsDoctor();
console.log(`Career Ops doctor: OK (${result.version}, ${result.commit})`);
