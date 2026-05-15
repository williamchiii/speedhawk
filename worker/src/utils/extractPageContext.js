// Lighthouse audit IDs that indicate actionable performance problems
const PERF_AUDIT_IDS = [
  "render-blocking-resources",
  "render-blocking-insight",
  "unused-javascript",
  "unused-css-rules",
  "uses-optimized-images",
  "uses-responsive-images",
  "offscreen-images",
  "uses-webp-images",
  "uses-text-compression",
  "dom-size",
  "bootup-time",
  "third-party-summary",
];

// Return poorly perfoming audits (score < 0.9) with a truncated description so the prompt stays small
function getActionableAudits(lhr) {
  return PERF_AUDIT_IDS.reduce((acc, id) => {
    const audit = lhr.audits?.[id];
    if (!audit) return acc;
    if (audit.scoreDisplayMode === "notApplicable" || audit.scoreDisplayMode === "informative") return acc;
    if (audit.score !== null && audit.score >= 0.9) return acc;

    acc.push({
      id,
      title: audit.title,
      score: audit.score,
      displayValue: audit.displayValue ?? null,
      // Strip markdown links from descriptions to keep them short
      description: audit.description?.replace(/\[.*?\]\(.*?\)/g, "").slice(0, 120) ?? null,
    });
    return acc;
  }, []).slice(0, 8);
}

// Return the largest JS, CSS, font, and image transfers so Gemini can name specific files
function getLargestNetworkResources(lhr) {
  const relevantTypes = new Set(["script", "stylesheet", "font", "image"]);
  const items = lhr.audits?.["network-requests"]?.details?.items ?? [];

  return items
    .filter((item) => relevantTypes.has(item.resourceType))
    .sort((a, b) => (b.transferSize ?? 0) - (a.transferSize ?? 0))
    .slice(0, 8)
    .map((item) => ({
      // Strip query strings and truncate long paths so the prompt stays readable
      url: item.url?.split("?")[0].slice(-80) ?? null,
      type: item.resourceType,
      transferKB: item.transferSize != null ? Math.round(item.transferSize / 1024) : null,
    }));
}

function getRenderBlockingResources(lhr) {
  // Prefer the newer insight audit; fall back to the legacy audit id
  const auditId = lhr.audits?.["render-blocking-insight"]
    ? "render-blocking-insight"
    : "render-blocking-resources";

  return (lhr.audits?.[auditId]?.details?.items ?? []).map((item) => ({
    url: item.url?.split("?")[0].slice(-80) ?? null,
    wastedMs: item.wastedMs != null ? Math.round(item.wastedMs) : null,
  }));
}

function getUnoptimizedImages(lhr) {
  const imageAuditIds = [
    "uses-optimized-images",
    "uses-responsive-images",
    "offscreen-images",
    "uses-webp-images",
    "efficiently-encode-images",
  ];

  const seen = new Set();
  const results = [];

  for (const auditId of imageAuditIds) {
    for (const item of lhr.audits?.[auditId]?.details?.items ?? []) {
      const url = item.url?.split("?")[0].slice(-80);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      results.push({
        url,
        wastedKB: item.wastedBytes != null ? Math.round(item.wastedBytes / 1024) : null,
        reason: auditId,
      });
    }
  }

  return results.sort((a, b) => (b.wastedKB ?? 0) - (a.wastedKB ?? 0)).slice(0, 6);
}

async function getDomMetadata(page) {
  if (!page) return null;
  try {
    return await page.evaluate(() => {
      const aboveFoldImages = Array.from(document.images)
        .filter((img) => img.getBoundingClientRect().top < window.innerHeight && img.src)
        .sort((a, b) => b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight)
        .slice(0, 5)
        .map((img) => img.src.split("?")[0].slice(-80));

      return {
        title: document.title?.slice(0, 100) ?? null,
        metaDescription: document.querySelector('meta[name="description"]')?.content?.slice(0, 200) ?? null,
        scriptCount: document.scripts.length,
        stylesheetCount: document.styleSheets.length,
        imageCount: document.images.length,
        aboveFoldImageUrls: aboveFoldImages,
      };
    });
  } catch {
    return null;
  }
}

export async function extractPageContext(lhr, page = null) {
  return {
    actionableAudits: getActionableAudits(lhr),
    largestNetworkResources: getLargestNetworkResources(lhr),
    renderBlockingResources: getRenderBlockingResources(lhr),
    unoptimizedImages: getUnoptimizedImages(lhr),
    domMetadata: await getDomMetadata(page),
  };
}
