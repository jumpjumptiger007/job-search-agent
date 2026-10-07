import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = fs.readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");

function token(block: string, name: string) {
  const match = block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?)`));
  if (!match) throw new Error(`Missing ${name}`);
  return match[1].length === 4 ? `#${[...match[1].slice(1)].map((digit) => digit + digit).join("")}` : match[1];
}

function rgb(hex: string) {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
}

function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(first: string, second: string) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const light = [...css.matchAll(/:root\{([^}]*)\}/g)].map((match) => match[1]).join(";");
const dark = [...css.matchAll(/:root\[data-theme="dark"\]\{([^}]*)\}/g)].map((match) => match[1]).join(";");
const systemDark = [...css.matchAll(/:root:not\(\[data-theme\]\)\{([^}]*)\}/g)].map((match) => match[1]).join(";");

describe("primary action colors and interaction semantics", () => {
  it("uses separate action surfaces while retaining bright dark foreground accents", () => {
    for (const theme of [dark, systemDark]) {
      expect(token(theme, "--accent")).toBe("#72b7ff");
      expect(token(theme, "--action-primary-bg")).not.toBe(token(theme, "--accent"));
    }
    expect(token(light, "--action-primary-bg")).toBe("#0a66c2");

    expect(css).toMatch(/button,\.button\{[^}]*background:var\(--action-primary-bg\);color:var\(--action-primary-fg\)/);
    expect(css).toMatch(/\.primary-link\{[^}]*background:var\(--action-primary-bg\);color:var\(--action-primary-fg\)/);
    expect(css).toMatch(/\.detail-link-button\{[^}]*background:var\(--action-primary-bg\);color:var\(--action-primary-fg\)/);
  });

  it("keeps primary states readable and secondary/select/copy controls distinct", () => {
    expect(css).toContain("--action-primary-hover");
    expect(css).toContain("--action-primary-active");
    expect(css).toContain("--action-primary-disabled-bg");
    expect(css).toContain("--action-primary-disabled-fg");
    expect(css).toMatch(/\.secondary,select\{[^}]*color:var\(--ink\)!important;border:1px solid var\(--line\)!important/);
    expect(css).toMatch(/\.text-button\{[^}]*background:transparent;color:var\(--accent\)/);
    expect(css).toMatch(/\.source-details-copy\{[^}]*background:transparent/);
    expect(css).toMatch(/label\.appearance-control select\{[^}]*background:var\(--card\)!important;color:var\(--ink\)!important/);
  });

  it("keeps normal, hover, active, and disabled action labels at WCAG AA contrast", () => {
    for (const theme of [light, dark, systemDark]) {
      const foreground = token(theme, "--action-primary-fg");
      for (const surface of ["--action-primary-bg", "--action-primary-hover", "--action-primary-active"]) {
        expect(contrast(foreground, token(theme, surface))).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(token(theme, "--action-primary-disabled-fg"), token(theme, "--action-primary-disabled-bg"))).toBeGreaterThanOrEqual(4.5);

      const ink = token(theme, "--ink");
      const card = token(theme, "--card");
      expect(contrast(ink, card)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(token(theme, "--accent"), token(theme, "--accent-pale"))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
