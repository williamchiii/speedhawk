//Validates AI-generated suggestions to ensure they meet database schema requirements
//if not then fall back to non AI suggestions

const VALID_TYPES = new Set(["performance", "bundle", "image", "rendering"]);
const VALID_IMPACTS = new Set(["high", "medium", "low"]);

export function validateSuggestions(suggestions, jobId) {
  //ensure input is an array
  if (!Array.isArray(suggestions)) {
    console.warn(
      `[Job ${jobId}] AI response is not an array:`,
      typeof suggestions,
    );
    return [];
  }
  //Validate each suggestion has required fields matching schema
  const validSuggestions = suggestions.filter((s) => {
    const type = typeof s.type === "string" ? s.type.trim() : "";
    const message = typeof s.message === "string" ? s.message.trim() : "";
    const impact = typeof s.impact === "string" ? s.impact.trim() : "";

    if (!type || !message || !impact) {
      console.warn(
        `[Job ${jobId}] Invalid AI suggestion (missing required fields):`,
        s,
      );
      return false;
    }

    if (!VALID_TYPES.has(type)) {
      console.warn(
        `[Job ${jobId}] Invalid AI suggestion (unsupported type "${type}"):`,
        s,
      );
      return false;
    }

    if (!VALID_IMPACTS.has(impact)) {
      console.warn(
        `[Job ${jobId}] Invalid AI suggestion (unsupported impact "${impact}"):`,
        s,
      );
      return false;
    }

    return true;
  });
  console.log(
    `[Job ${jobId}] Validated ${validSuggestions.length}/${suggestions.length} AI suggestions`,
  );
  return validSuggestions;
}

//generates non AI fallback suggestions based on the performance metrics
export function getFallbackSuggestions(metrics) {
  const { score, ttfb, fcp, lcp, bundleSize } = metrics;
  const suggestions = [];

  // LCP-based suggestions
  if (lcp > 4000) {
    suggestions.push({
      type: "performance",
      message:
        "LCP is critically slow (>4s). This severely impacts user experience. Prioritize optimizing your largest image and reduce server response time.",
      impact: "high",
    });
  } else if (lcp > 2500) {
    suggestions.push({
      type: "performance",
      message:
        'LCP exceeds the "good" threshold (2.5s). Consider lazy-loading below-the-fold images and optimizing your largest contentful element.',
      impact: "high",
    });
  }

  // Bundle size suggestions
  if (bundleSize > 1000) {
    suggestions.push({
      type: "bundle",
      message: `Total page weight is very large (${bundleSize}KB). Implement code splitting, optimize images, and remove unused dependencies.`,
      impact: "high",
    });
  } else if (bundleSize > 500) {
    suggestions.push({
      type: "bundle",
      message: `Page weight is large (${bundleSize}KB). Consider lazy-loading non-critical resources and compressing assets.`,
      impact: "medium",
    });
  }

  // FCP-based suggestions
  if (fcp > 3000) {
    suggestions.push({
      type: "rendering",
      message:
        "First Contentful Paint is slow (>3s). Reduce render-blocking resources and inline critical CSS.",
      impact: "high",
    });
  }

  // TTFB-based suggestions
  if (ttfb > 800) {
    suggestions.push({
      type: "performance",
      message: `Server response time is slow (${ttfb}ms). Consider using a CDN, enabling caching, or upgrading server resources.`,
      impact: "medium",
    });
  }

  // Ensure we always return at least one suggestion
  if (suggestions.length === 0) {
    suggestions.push({
      type: "performance",
      message: `Performance score is ${score}/100. Review Core Web Vitals and optimize based on your specific bottlenecks.`,
      impact: "medium",
    });
  }

  return suggestions;
}