export function scoreColor(score) {
  if (score >= 85) return "text-success";
  if (score >= 40) return "text-warning";
  return "text-error";
}

export function scoreLabel(score) {
  if (score >= 85) return "Good";
  if (score >= 40) return "Needs Work";
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
