import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { POST } from "../app/api/discover/route";
import { runDiscovery } from "@/lib/discovery";

const require = createRequire(import.meta.url);
const { isInternalUrl } = require("../desktop/lib/workspace.cjs");

vi.mock("@/lib/discovery", () => ({ runDiscovery: vi.fn() }));

describe("POST /api/discover", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps the ordinary form redirect on the request origin", async () => {
    const activeOrigin = "http://127.0.0.1:43127";
    const response = await POST(new Request(`${activeOrigin}/api/discover`, { method: "POST" }));
    const location = response.headers.get("location") ?? "";

    expect(response.status).toBe(303);
    expect(location).toBe(`${activeOrigin}/`);
    expect(isInternalUrl(location, activeOrigin)).toBe(true);
    expect(runDiscovery).toHaveBeenCalledTimes(1);
  });

  it("returns JSON success to an explicit client request", async () => {
    const response = await POST(new Request("http://127.0.0.1:43127/api/discover", { method: "POST", headers:{accept:"application/json"} }));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ok:true});
    expect(runDiscovery).toHaveBeenCalledTimes(1);
  });
});
