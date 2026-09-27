"use client";

import { useState } from "react";

export default function CopyCodexPrompt({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);
  return <button className="secondary" type="button" onClick={async () => { await navigator.clipboard.writeText(prompt); setCopied(true); }}>{copied ? "Copied Codex prompt" : "Copy Codex prompt"}</button>;
}
