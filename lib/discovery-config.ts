import fs from "node:fs";
import YAML from "yaml";
import { resolveProjectPath } from "./project-root";

export type DiscoverySourceRow = { key: string; name: string; outcomeName: string; enabled: boolean; limit?: number };
const sourceNames: Record<string, { name: string; outcomeName: string }> = {
  bundesagentur: { name: "Bundesagentur", outcomeName: "Bundesagentur für Arbeit" },
  arbeitnow: { name: "Arbeitnow", outcomeName: "Arbeitnow" },
  workable: { name: "Workable", outcomeName: "Workable" },
  linkedin: { name: "LinkedIn", outcomeName: "LinkedIn" },
  webSearch: { name: "Web Search", outcomeName: "Web search" },
};
const providerNames: Record<string, string> = { greenhouse: "Greenhouse", lever: "Lever", personio: "Personio" };

/** Return an allowlisted display projection of config/search.yaml; never expose config values. */
export function discoverySourceConfig(file = resolveProjectPath("config/search.yaml")) {
  if (!fs.existsSync(file)) return { available: false, sources: [] as DiscoverySourceRow[] };
  try {
    const config = YAML.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown> | null;
    if (!config || typeof config !== "object" || Array.isArray(config)) return { available: false, sources: [] as DiscoverySourceRow[] };
    const sources: DiscoverySourceRow[] = [];
    for (const [key, label] of Object.entries(sourceNames)) {
      const entry = config[key];
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const source = entry as Record<string, unknown>;
      sources.push({ key, ...label, enabled: source.enabled === true, ...(Number.isFinite(source.limit) ? { limit: Number(source.limit) } : {}) });
    }
    if (Array.isArray(config.providers)) {
      config.providers.forEach((entry, index) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
        const provider = entry as Record<string, unknown>;
        const type = typeof provider.type === "string" ? provider.type.toLowerCase() : "";
        const name = providerNames[type];
        if (!name) return;
        sources.push({ key: `provider-${index}`, name, outcomeName: name, enabled: provider.enabled === true, ...(Number.isFinite(provider.limit) ? { limit: Number(provider.limit) } : {}) });
      });
    }
    return { available: true, sources };
  } catch {
    return { available: false, sources: [] as DiscoverySourceRow[] };
  }
}
