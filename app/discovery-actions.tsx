"use client";

import { createContext, useContext, useMemo, useState, type FormEvent, type ReactNode } from "react";

type DiscoveryActionState = { pending:boolean; source:string|null; error:string|null };
type DiscoveryResponse = { ok:boolean };

export function createDiscoverySubmitter(
  request:()=>Promise<DiscoveryResponse>,
  onState:(state:DiscoveryActionState)=>void,
  onSuccess:()=>void,
) {
  let pending = false;
  return async (source:string) => {
    if (pending) return;
    pending = true;
    onState({ pending:true, source, error:null });
    try {
      if (!(await request()).ok) throw new Error("Discovery request failed");
      onSuccess();
    } catch {
      pending = false;
      onState({ pending:false, source, error:"Discovery failed. Please try again." });
    }
  };
}

const DiscoveryActionsContext = createContext<{
  state:DiscoveryActionState;
  submit:(source:string)=>Promise<void>;
}|null>(null);

export function DiscoveryActions({ children }:{ children:ReactNode }) {
  const [state, setState] = useState<DiscoveryActionState>({ pending:false, source:null, error:null });
  const submit = useMemo(() => createDiscoverySubmitter(
    () => fetch("/api/discover", { method:"POST" }),
    setState,
    () => window.location.assign("/"),
  ), []);

  return <DiscoveryActionsContext.Provider value={{ state, submit }}>{children}</DiscoveryActionsContext.Provider>;
}

export function DiscoveryForm({ source }:{ source:string }) {
  const actions = useContext(DiscoveryActionsContext);
  if (!actions) throw new Error("DiscoveryForm must be inside DiscoveryActions");
  return <DiscoveryFormView state={actions.state} source={source} submit={actions.submit} />;
}

export function DiscoveryFormView({ state, source, submit }:{ state:DiscoveryActionState; source:string; submit:(source:string)=>Promise<void> }) {
  const active = state.source === source;
  const onSubmit = (event:FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit(source);
  };

  return <form action="/api/discover" method="post" className="discovery-form" onSubmit={onSubmit}>
    <button type="submit" disabled={state.pending}>{state.pending ? "Running Discovery…" : "Run Discovery"}</button>
    {active && state.pending && <p className="discovery-feedback" role="status" aria-live="polite" aria-busy="true"><span className="discovery-spinner" aria-hidden="true" />Searching configured sources. This may take a little while.</p>}
    {active && state.error && <p className="discovery-feedback discovery-error" role="alert">{state.error}</p>}
  </form>;
}
