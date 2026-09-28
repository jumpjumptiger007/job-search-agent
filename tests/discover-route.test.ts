import { describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { POST } from "../app/api/discover/route";
import { runDiscovery } from "@/lib/discovery";

const require = createRequire(import.meta.url);
const { isInternalUrl } = require("../desktop/lib/workspace.cjs");

vi.mock("@/lib/discovery", () => ({ runDiscovery: vi.fn() }));

describe("POST /api/discover", () => {
  it("redirects to the request origin and keeps the redirect inside the active Electron backend", async () => {
    const activeOrigin = "http://127.0.0.1:43127";
    for (const origin of [activeOrigin, "http://localhost:43127"]) {
      const response = await POST(new Request(`${origin}/api/discover`, { method: "POST" }));
      const location = response.headers.get("location") ?? "";

      expect(response.status).toBe(303);
      expect(location).toBe(`${origin}/`);
      expect(isInternalUrl(location, activeOrigin)).toBe(true);
    }

    expect(runDiscovery).toHaveBeenCalledTimes(2);
  });
});
