import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createDiscoverySubmitter, DiscoveryActions, DiscoveryForm, DiscoveryFormView } from "../app/discovery-actions";

describe("Dashboard Discovery actions", () => {
  it("renders both entry points enabled with the initial label", () => {
    const html = renderToStaticMarkup(<DiscoveryActions><><DiscoveryForm source="intro"/><DiscoveryForm source="card"/></></DiscoveryActions>);

    expect(html.match(/Run Discovery/g)).toHaveLength(2);
    expect(html).not.toContain(" disabled");
    expect(html.match(/action=\\?"\/api\/discover/g)).toHaveLength(2);
  });

  it("shows pending feedback and disables both shared entry points", () => {
    const submit = vi.fn(async () => {});
    const html = renderToStaticMarkup(<><DiscoveryFormView state={{ pending:true, source:"card", error:null }} source="intro" submit={submit}/><DiscoveryFormView state={{ pending:true, source:"card", error:null }} source="card" submit={submit}/></>);

    expect(html.match(/Running Discovery…/g)).toHaveLength(2);
    expect(html.match(/disabled/g)).toHaveLength(2);
    expect(html).toContain("Searching configured sources. This may take a little while.");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
  });

  it("prevents a second form from submitting while the first request is pending, then completes on success", async () => {
    let resolveRequest!:(response:{ok:boolean})=>void;
    const request = vi.fn(() => new Promise<{ok:boolean}>((resolve) => { resolveRequest = resolve; }));
    const onState = vi.fn();
    const onSuccess = vi.fn();
    const submit = createDiscoverySubmitter(request, onState, onSuccess);
    const first = submit("intro");

    expect(onState).toHaveBeenLastCalledWith({ pending:true, source:"intro", error:null });
    await submit("card");
    expect(request).toHaveBeenCalledTimes(1);
    resolveRequest({ ok:true });
    await first;
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onState).toHaveBeenCalledTimes(1);
  });

  it("shows an error after failure and allows retry", async () => {
    const request = vi.fn().mockResolvedValueOnce({ ok:false }).mockResolvedValueOnce({ ok:true });
    const onState = vi.fn();
    const onSuccess = vi.fn();
    const submit = createDiscoverySubmitter(request, onState, onSuccess);

    await submit("intro");
    expect(onState).toHaveBeenLastCalledWith({ pending:false, source:"intro", error:"Discovery failed. Please try again." });
    expect(renderToStaticMarkup(<DiscoveryFormView state={onState.mock.lastCall![0]} source="intro" submit={submit}/>)).toContain('role="alert"');

    await submit("card");
    expect(request).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});
