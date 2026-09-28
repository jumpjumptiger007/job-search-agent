import path from "node:path";

export const getProjectRoot = () => path.resolve(process.env.JOB_AGENT_WORKSPACE_ROOT || process.cwd());
export const resolveProjectPath = (...segments: string[]) => path.resolve(getProjectRoot(), ...segments);
export const getStorageRoot = () => path.resolve(process.env.JOB_AGENT_STORAGE_ROOT || getProjectRoot());
