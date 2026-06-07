import axios from "axios";
import { useState } from "react";
import { apiUrl } from "../utils/apiURL.js";
import { scoreColor, scoreLabel, ms, kb } from "../utils/auditHelpers.js";

// ── sub-components ────────────────────────────────────────────────────────────

function ScoreRing({ score }) {
  if (score == null) return null;
  const pct = Math.max(0, Math.min(100, score));

  return (
    <div className={`flex flex-col items-center gap-2 ${scoreColor(score)}`}>
      <div
        className="grid h-28 w-28 place-items-center rounded-full"
        style={{ background: `conic-gradient(currentColor ${pct}%, rgba(255,255,255,.08) 0)` }}
      >
        <div className="grid h-20 w-20 place-items-center rounded-full bg-base-100">
          <span className="text-3xl font-bold">
          {score}
          </span>
        </div>
      </div>
      <span className="text-sm font-semibold">{scoreLabel(score)}</span>
    </div>
  );
}

function MetricRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-white/10 last:border-0">
      <span className="text-sm text-white/50">{label}</span>
      <span className="text-sm font-mono font-medium text-white/90">{value}</span>
    </div>
  );
}

function MetricsCard({ metrics }) {
  if (!metrics) return null;
  return (
    <div className="card border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl">
      <div className="card-body gap-2 p-5">
        <h3 className="card-title text-base text-white">Core Web Vitals</h3>
        <MetricRow label="Time to First Byte (TTFB)" value={ms(metrics.ttfb)} />
        <MetricRow label="First Contentful Paint (FCP)" value={ms(metrics.fcp)} />
        <MetricRow label="Largest Contentful Paint (LCP)" value={ms(metrics.lcp)} />
        <MetricRow label="Total Bundle Size" value={kb(metrics.bundle_size)} />
        <MetricRow label="Image Weight" value={kb(metrics.image_weight)} />
      </div>
    </div>
  );
}

function SuggestionsTerminal({ suggestions }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-xl shadow-xl overflow-hidden font-mono">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-white/5">
        <span className="h-3 w-3 rounded-full bg-red-400/80" />
        <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
        <span className="h-3 w-3 rounded-full bg-green-400/80" />
        <span className="ml-2 text-xs text-white/40">speedhawk — suggestions ({suggestions.length})</span>
      </div>

      {/* Body */}
      <div className="p-4 text-sm leading-relaxed flex flex-col gap-2">
        {suggestions.map((s) => (
          <div key={s.id} className="flex gap-2">
            <span className="text-green-400 select-none shrink-0">$</span>
            <p className="text-white/85 wrap-break-word">{s.message}</p>
          </div>
        ))}
        <div className="flex gap-2 items-center">
          <span className="text-green-400 select-none shrink-0">$</span>
          <span className="inline-block h-4 w-2 bg-white/70 animate-pulse" />
        </div>
      </div>
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
        <SuggestionsTerminal suggestions={data.suggestions} />
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
          className="input flex-1 border-white/20 bg-white/10 text-white placeholder:text-white/50"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
        />
        <button className="btn border-white/20 bg-white/20 text-white hover:bg-white/30" type="submit" disabled={loading}>
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
        <div className="text-sm text-white/70">{result.payload}</div>
      )}

      {result?.type === "data" && (
        <AuditResults data={result.payload} />
      )}
    </div>
  );
};

export default Audit;
