import { db } from "@/lib/db";
import { discoveryRunPresentation, discoverySourceOutcomes, discoverySummary, discoveryUnmatchedErrors } from "@/lib/dashboard";
import { discoverySourceConfig } from "@/lib/discovery-config";
import { DiscoveryActions, DiscoveryForm } from "../discovery-actions";

export const dynamic = "force-dynamic";

function recentRuns() {
  return db().prepare("SELECT * FROM discovery_runs ORDER BY id DESC LIMIT 12").all() as Record<string, any>[];
}

export default function Page() {
  const config = discoverySourceConfig();
  const runs = recentRuns();
  const latest = runs[0];
  const latestOutcomes = latest ? new Map(discoverySourceOutcomes(latest).map((item) => [item.name.toLocaleLowerCase(), item])) : new Map();
  return <DiscoveryActions successHref="/discovery"><main className="discovery-page">
    <section className="page-intro"><div><h2>Discovery Control Panel</h2><p>Run the configured sources and inspect recent results. Source configuration is read-only here and managed in config/search.yaml.</p></div><DiscoveryForm source="discovery" /></section>
    <section className="discovery-sources"><div className="page-section-heading"><div><h3>Configured sources</h3><p>Current local configuration · read only</p></div></div>
      {!config.available ? <p className="inline-notice">Source configuration is unavailable or could not be read.</p> : config.sources.length ? <div className="source-list">{config.sources.map((source) => {
        const outcome = latestOutcomes.get(source.outcomeName.toLocaleLowerCase());
        const latestStatus = !source.enabled ? "Off" : outcome ? outcome.status === "succeeded" ? "Succeeded in latest run" : "Failed in latest run" : "Not attempted yet";
        return <div className="source-row" key={source.key}><strong>{source.name}</strong><span className={source.enabled ? "source-enabled" : "source-disabled"}>{source.enabled ? "Enabled" : "Disabled"}</span><span>{latestStatus}</span><span>{source.limit === undefined ? "—" : `Limit ${source.limit}`}</span></div>;
      })}</div> : <p className="inline-notice">No supported discovery sources are configured.</p>}
    </section>
    <section className="discovery-history"><div className="page-section-heading"><div><h3>Recent runs</h3><p>Stored discovery results and source outcomes.</p></div><span>{runs.length} shown</span></div>
      {runs.length ? <div className="run-list">{runs.map((run) => {
        const presentation = discoveryRunPresentation(run);
        const outcomes = discoverySourceOutcomes(run);
        const unmatchedErrors = discoveryUnmatchedErrors(run);
        return <details className="run-row" key={run.id}><summary><span className="run-status">{presentation.status}</span><span className="run-summary">{discoverySummary(run)}</span><time>{run.started_at}</time><span className="run-disclosure">Details</span></summary>
          <div className="run-detail"><p>{presentation.message}</p><dl><div><dt>Started</dt><dd>{run.started_at || "—"}</dd></div><div><dt>Ended</dt><dd>{run.ended_at || "In progress"}</dd></div><div><dt>Sources attempted</dt><dd>{run.sources_attempted || "—"}</dd></div><div><dt>Seen · new · duplicates</dt><dd>{run.jobs_seen ?? 0} · {run.new_jobs ?? 0} · {run.duplicates ?? 0}</dd></div><div><dt>Candidates checked · filtered · accepted</dt><dd>{run.upstream_candidates ?? "—"} · {run.filtered_candidates ?? "—"} · {run.accepted_candidates ?? "—"}</dd></div><div><dt>Failures · blocked</dt><dd>{run.failures ?? 0} · {run.blocked_sources ?? 0}</dd></div></dl>
            {outcomes.length > 0 && <ul className="run-outcomes">{outcomes.map((outcome) => <li key={outcome.name}><strong>{outcome.name}</strong><span>{outcome.status === "succeeded" ? "Completed" : "Failed"}</span>{outcome.error && <small>{outcome.error}</small>}</li>)}</ul>}
            {unmatchedErrors.map((error, index) => <p className="discovery-run-error" key={`${index}-${error}`}>{error}</p>)}
          </div>
        </details>;
      })}</div> : <p className="inline-notice">No Discovery runs have been recorded yet.</p>}
    </section>
  </main></DiscoveryActions>;
}
