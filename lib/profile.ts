import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { getStorageRoot } from "./project-root";

export type FactualExperience = { employer: string; title: string; dates?: string; bullets?: string[] };
export type FactualProfile = { name: string; email?: string; phone?: string; location?: string; summary?: string; skills?: string[]; competencies?: Record<string, string[]>; experience?: FactualExperience[]; education?: string[]; roleFamilies?: string[]; preferredLocations?: string[]; languages?: string[]; remotePreference?: string };

const strings = (value: unknown, name: string) => {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error(`Invalid factual profile: ${name} must be a string list`);
};

export function validateFactualProfile(value: unknown): asserts value is FactualProfile {
  if (!value || typeof value !== "object" || typeof (value as any).name !== "string" || !(value as any).name.trim()) throw new Error("Invalid factual profile: name is required");
  const profile = value as any;
  for (const key of ["skills", "education", "roleFamilies", "preferredLocations", "languages"]) strings(profile[key], key);
  if (profile.experience !== undefined && (!Array.isArray(profile.experience) || profile.experience.some((item: any) => !item || typeof item.employer !== "string" || typeof item.title !== "string" || (item.bullets !== undefined && (!Array.isArray(item.bullets) || item.bullets.some((bullet: unknown) => typeof bullet !== "string")))))) throw new Error("Invalid factual profile: experience entries require employer, title, and optional string bullets");
  if (profile.competencies !== undefined && (typeof profile.competencies !== "object" || Object.values(profile.competencies).some((items) => !Array.isArray(items) || items.some((item) => typeof item !== "string")))) throw new Error("Invalid factual profile: competencies must contain string lists");
}

export function loadFactualProfile(): FactualProfile | undefined {
  const file = path.join(getStorageRoot(), "profile", "profile.yaml");
  if (!fs.existsSync(file)) return undefined;
  const profile = YAML.parse(fs.readFileSync(file, "utf8"));
  validateFactualProfile(profile);
  return profile;
}
