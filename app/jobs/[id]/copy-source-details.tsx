"use client";

import { useEffect, useRef, useState } from "react";
import { tryCopyText, type CopyResult } from "./copy-clipboard";

export function CopySourceDetailsControl({ state, onCopy }: { state: CopyResult | "idle"; onCopy: () => void }) {
  const copied = state === "success";
  return <>
    <button className="source-details-copy" type="button" onClick={onCopy} aria-label="Copy source details" title={copied ? "Copied" : "Copy source details"}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {copied ? <path d="m5 12 4 4L19 6" /> : <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>}
      </svg>
    </button>
    <span className="source-details-copy-feedback copy-feedback" role="status" aria-live="polite">{copied ? "Source details copied." : ""}</span>
    {state === "error" && <span className="source-details-copy-feedback copy-feedback copy-feedback-error" role="alert">Could not copy source details.</span>}
  </>;
}

export default function CopySourceDetails({ text }: { text: string }) {
  const [state, setState] = useState<CopyResult | "idle">("idle");
  const timeout = useRef<number | null>(null);
  const attempt = useRef(0);

  useEffect(() => () => {
    attempt.current += 1;
    if (timeout.current !== null) window.clearTimeout(timeout.current);
  }, []);

  async function copy() {
    const currentAttempt = ++attempt.current;
    if (timeout.current !== null) window.clearTimeout(timeout.current);
    timeout.current = null;
    setState("idle");

    const result = await tryCopyText(text, (value) => navigator.clipboard.writeText(value));
    if (attempt.current !== currentAttempt) return;
    setState(result);
    if (result === "success") {
      timeout.current = window.setTimeout(() => {
        if (attempt.current === currentAttempt) {
          setState("idle");
          timeout.current = null;
        }
      }, 1700);
    }
  }

  return <CopySourceDetailsControl state={state} onCopy={() => void copy()} />;
}
