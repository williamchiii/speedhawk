// Cutoffs match Lighthouse's documented control points: 90+ is green/good,
// 50–89 is the orange "needs improvement" band, and below 50 is red/poor.
// See https://developer.chrome.com/docs/lighthouse/performance/performance-scoring
export function scoreColor(score) {
  if (score >= 90) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-error";
}

export function scoreLabel(score) {
  if (score >= 90) return "Good";
  if (score >= 50) return "Needs Work";
  return "Poor";
}

export function impactBadge(impact) {
  const map = {
    high:   "badge badge-error",
    medium: "badge badge-warning",
    low:    "badge badge-info",
  };
  return map[impact] ?? "badge";
}

export function typeBadge(type) {
  const map = {
    performance: "badge badge-primary badge-outline",
    bundle:      "badge badge-secondary badge-outline",
    image:       "badge badge-accent badge-outline",
    rendering:   "badge badge-neutral badge-outline",
  };
  return map[type] ?? "badge badge-outline";
}

export function ms(val) {
  if (val == null) return "—";
  return `${val.toLocaleString()} ms`;
}

export function kb(val) {
  if (val == null) return "—";
  return `${val.toLocaleString()} KB`;
}
