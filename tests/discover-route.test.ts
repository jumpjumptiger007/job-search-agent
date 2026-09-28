import { describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/discover/route";
import { runDiscovery } from "@/lib/discovery";

vi.mock("@/lib/discovery", () => ({ runDiscovery: vi.fn() }));

describe("POST /api/discover", () => {
  it("redirects to the root of the request origin", async () => {
    const response = await POST(new Request("http://127.0.0.1:43127/api/discover", { method: "POST" }));

    expect(runDiscovery).toHaveBeenCalledOnce();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://127.0.0.1:43127/");
  });
});
