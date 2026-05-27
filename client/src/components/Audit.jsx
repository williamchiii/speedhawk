import axios from "axios";
import { useState } from "react";
import { apiUrl } from "../utils/apiURL.js";
import { scoreColor, scoreLabel, ms, kb } from "../utils/auditHelpers.js";

// ── sub-components ────────────────────────────────────────────────────────────

function ScoreRing({ score }) {
  if (score == null) return null;
  const radius = 40;
  const circ = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score));
  const dash = (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={radius} fill="none" stroke="currentColor"
          className="text-base-300" strokeWidth="10" />
        <circle cx="55" cy="55" r={radius} fill="none"
          stroke="currentColor"
          className={scoreColor(score)}
          strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 55 55)"
        />
        <text x="55" y="60" textAnchor="middle"
          className={`text-2xl font-bold fill-current ${scoreColor(score)}`}
          fontSize="22" fontWeight="bold" fill="currentColor">
          {score}
        </text>
      </svg>
      <span className={`text-sm font-semibold ${scoreColor(score)}`}>
        {scoreLabel(score)}
      </span>
    </div>
  );
}

function MetricRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-base-300 last:border-0">
      <span className="text-sm text-base-content/60">{label}</span>
      <span className="text-sm font-mono font-medium">{value}</span>
    </div>
  );
}

function MetricsCard({ metrics }) {
  if (!metrics) return null;
  return (
    <div className="card bg-base-200 shadow-sm">
      <div className="card-body gap-2 p-5">
        <h3 className="card-title text-base">Core Web Vitals</h3>
        <MetricRow label="Time to First Byte (TTFB)" value={ms(metrics.ttfb)} />
        <MetricRow label="First Contentful Paint (FCP)" value={ms(metrics.fcp)} />
        <MetricRow label="Largest Contentful Paint (LCP)" value={ms(metrics.lcp)} />
        <MetricRow label="Total Bundle Size" value={kb(metrics.bundle_size)} />
        <MetricRow label="Image Weight" value={kb(metrics.image_weight)} />
      </div>
    </div>
  );
}

function SuggestionCard({ suggestion }) {
  return (
    <div className="border-l-2 border-base-300 pl-4 py-1">
      <p className="text-sm leading-relaxed">{suggestion.message}</p>
    </div>
  );
}

function AuditResults({ data }) {
  const completedAt = data.completed_at
    ? new Date(data.completed_at).toLocaleString()
    : null;

  return (
    <div className="w-full flex flex-col gap-6">

      {/* Header row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-base-content/50 uppercase tracking-widest mb-1">Audited URL</p>
          <a href={data.url} target="_blank" rel="noreferrer"
            className="link link-primary text-sm break-all">
            {data.url}
          </a>
          {completedAt && (
            <p className="text-xs text-base-content/40 mt-1">Completed {completedAt}</p>
          )}
        </div>
        <ScoreRing score={data.score} />
      </div>

      {/* Metrics */}
      {data.metrics && <MetricsCard metrics={data.metrics} />}

      {/* Suggestions */}
      {data.suggestions?.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="font-semibold text-base">
            Suggestions
            <span className="ml-2 badge badge-ghost">{data.suggestions.length}</span>
          </h3>
          {data.suggestions.map((s) => (
            <SuggestionCard key={s.id} suggestion={s} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

const Audit = () => {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState(null);   // { type: "status"|"data"|"error", payload }
  const [loading, setLoading] = useState(false);

  const testAudit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const createRes = await axios.post(apiUrl("/api/audits"), { url });
      const audit = createRes.data.audit;

      setResult({ type: "status", payload: `Created audit ${audit.id}, waiting…` });

      let attempts = 0;
      const maxAttempts = 60; // 120 s / 2

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const getRes = await axios.get(apiUrl(`/api/audits/${audit.id}`));
        const data = getRes.data;

        if (data.status === "complete") {
          setResult({ type: "data", payload: data });
          return;
        } else if (data.status === "failed") {
          setResult({ type: "error", payload: "Audit failed." });
          return;
        }

        attempts++;
        setResult({ type: "status", payload: `Checking… (${attempts * 2}s elapsed)` });
      }

      setResult({ type: "error", payload: `Timeout: audit took over ${maxAttempts * 2}s.` });
    } catch (error) {
      setResult({
        type: "error",
        payload: error?.message ? `Request failed: ${error.message}` : "Request failed.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl flex flex-col gap-6 mb-9">

      {/* Input form */}
      <form className="flex gap-2" onSubmit={testAudit}>
        <input
          className="input input-bordered flex-1"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
        />
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? <span className="loading loading-spinner loading-sm" /> : "Audit"}
        </button>
      </form>

      {/* Results area */}
      {result?.type === "status" && (
        <div className="flex items-center gap-3 text-sm text-base-content/60">
          <span className="loading loading-dots loading-sm" />
          {result.payload}
        </div>
      )}

      {result?.type === "error" && (
        <div className="alert alert-error text-sm">{result.payload}</div>
      )}

      {result?.type === "data" && (
        <AuditResults data={result.payload} />
      )}
    </div>
  );
};

export default Audit;
