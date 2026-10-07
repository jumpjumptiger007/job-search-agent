import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CopyCodexPromptControl } from "../app/jobs/[id]/copy-codex-prompt";
import { CopySourceDetailsControl } from "../app/jobs/[id]/copy-source-details";
import { tryCopyText } from "../app/jobs/[id]/copy-clipboard";

describe("job detail clipboard feedback", () => {
  it("reports clipboard write success and failure without throwing", async () => {
    const writeText = vi.fn(async () => {});
    await expect(tryCopyText("prompt", writeText)).resolves.toBe("success");
    expect(writeText).toHaveBeenCalledWith("prompt");

    await expect(tryCopyText("details", async () => { throw new Error("denied"); })).resolves.toBe("error");
  });

  it("shows a polite success status or visible error for the Codex prompt", () => {
    const onCopy = vi.fn();
    const success = renderToStaticMarkup(<CopyCodexPromptControl state="success" onCopy={onCopy} />);
    expect(success).toContain('class="secondary" type="button"');
    expect(success).toContain("Copied Codex prompt");
    expect(success).toContain('role="status" aria-live="polite">Codex prompt copied.</span>');
    expect(success).not.toContain('role="alert"');

    const error = renderToStaticMarkup(<CopyCodexPromptControl state="error" onCopy={onCopy} />);
    expect(error).toContain("Copy Codex prompt");
    expect(error).toContain('role="alert">Could not copy Codex prompt.</span>');
    expect(error).not.toContain("Codex prompt copied.");
  });

  it("keeps source-details button naming stable and announces success or failure", () => {
    const onCopy = vi.fn();
    const success = renderToStaticMarkup(<CopySourceDetailsControl state="success" onCopy={onCopy} />);
    expect(success).toContain('class="source-details-copy" type="button" aria-label="Copy source details"');
    expect(success).toContain('role="status" aria-live="polite">Source details copied.</span>');
    expect(success).toContain('<path d="m5 12 4 4L19 6"');
    expect(success).not.toContain('role="alert"');

    const error = renderToStaticMarkup(<CopySourceDetailsControl state="error" onCopy={onCopy} />);
    expect(error).toContain('aria-label="Copy source details"');
    expect(error).toContain('role="alert">Could not copy source details.</span>');
    expect(error).not.toContain("Source details copied.");
    expect(error).toContain('<rect x="8" y="8" width="12" height="12" rx="2"');
  });
});
