export { selectCanonical } from "./core/job-identity";
export { ingest,listJobs,getJob,setReviewStatus,setApplicationStatus,workflowQueues } from "./job-store";
export type JobStatus = "DISCOVERED" | "ANALYZED" | "MATERIAL_GENERATED";
export type MaterialStatus = "NOT_GENERATED" | "GENERATING" | "READY" | "ERROR";
