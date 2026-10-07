"use client";

import { useEffect, useRef, useState } from "react";
import { tryCopyText, type CopyResult } from "./copy-clipboard";

export function CopyCodexPromptControl({ state, onCopy }: { state: CopyResult | "idle"; onCopy: () => void }) {
  return <>
    <button className="secondary" type="button" onClick={onCopy}>{state === "success" ? "Copied Codex prompt" : "Copy Codex prompt"}</button>
    <span className="copy-feedback" role="status" aria-live="polite">{state === "success" ? "Codex prompt copied." : ""}</span>
    {state === "error" && <span className="copy-feedback copy-feedback-error" role="alert">Could not copy Codex prompt.</span>}
  </>;
}

export default function CopyCodexPrompt({ prompt }: { prompt: string }) {
  const [state, setState] = useState<CopyResult | "idle">("idle");
  const attempt = useRef(0);

  useEffect(() => () => { attempt.current += 1; }, []);

  async function copy() {
    const currentAttempt = ++attempt.current;
    setState("idle");
    const result = await tryCopyText(prompt, (text) => navigator.clipboard.writeText(text));
    if (attempt.current === currentAttempt) setState(result);
  }

  return <CopyCodexPromptControl state={state} onCopy={() => void copy()} />;
}
