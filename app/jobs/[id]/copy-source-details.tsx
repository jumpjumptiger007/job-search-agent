"use client";

import { useEffect, useRef, useState } from "react";

export default function CopySourceDetails({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timeout = useRef<number | null>(null);

  useEffect(() => () => {
    if (timeout.current) window.clearTimeout(timeout.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      if (timeout.current) window.clearTimeout(timeout.current);
      setCopied(true);
      timeout.current = window.setTimeout(() => setCopied(false), 1700);
    } catch {
      if (timeout.current) window.clearTimeout(timeout.current);
      timeout.current = null;
      setCopied(false);
    }
  }

  return <button className="source-details-copy" type="button" onClick={copy} aria-label={copied ? "Copied source details" : "Copy source details"} title={copied ? "Copied" : "Copy source details"}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {copied ? <path d="m5 12 4 4L19 6" /> : <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>}
    </svg>
  </button>;
}
