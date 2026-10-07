import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import AppShell from "../app/components/app-shell";

const root = process.cwd();

describe("shared shell accessibility", () => {
  it("provides a skip link to the page main landmark", () => {
    const html = renderToStaticMarkup(<AppShell><main id="main-content" tabIndex={-1}>Page content</main></AppShell>);

    expect(html).toContain('href="#main-content"');
    expect(html).toContain(">Skip to content</a>");
    expect(html).toContain('<main id="main-content" tabindex="-1">');
  });

  it("assigns one stable main target to every shared-shell page", () => {
    const pages = [
      "app/page.tsx",
      "app/jobs/page.tsx",
      "app/jobs/[id]/page.tsx",
      "app/applications/page.tsx",
      "app/discovery/page.tsx",
      "app/history/page.tsx",
      "app/exports/page.tsx",
      "app/components/page-foundation.tsx",
    ];

    for (const page of pages) {
      const source = fs.readFileSync(path.join(root, page), "utf8");
      expect(source.match(/<main\b[^>]*\bid="main-content"/g), page).toHaveLength(1);
    }
  });

  it("keeps reduced-motion and sticky-anchor behavior in shared CSS", () => {
    const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");

    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[^{]*\{\s*\.discovery-spinner\s*\{\s*animation:\s*none\s*\}/);
    expect(css).toMatch(/\.detail-module\[id\]\s*\{\s*scroll-margin-top:\s*64px\s*\}/);
  });
});
