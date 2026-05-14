### Documentation is stored here about the project architecture ###

---

## Metrics Reference

Speedhawk extracts the following metrics from each Lighthouse run and stores them in the `metrics` table. All values are nullable — if Lighthouse does not provide a value for a given audit, the field is stored as `NULL`.

### Core Web Vitals

| Column | Unit | Lighthouse source | Good threshold |
|---|---|---|---|
| `ttfb` | ms | `server-response-time` audit | < 800ms |
| `fcp` | ms | `metrics.firstContentfulPaint` | < 1800ms |
| `lcp` | ms | `metrics.largestContentfulPaint` | < 2500ms |
| `cls` | score | `cumulative-layout-shift` audit | < 0.1 |

- **TTFB** (Time to First Byte): How long the server took to start sending a response.
- **FCP** (First Contentful Paint): When the first text or image appears on screen.
- **LCP** (Largest Contentful Paint): When the main/largest visible element finishes rendering.
- **CLS** (Cumulative Layout Shift): How much the page layout jumps around during load. Closer to 0 is better.

### Performance Diagnostics

| Column | Unit | Lighthouse source | Good threshold |
|---|---|---|---|
| `speed_index` | ms | `metrics.speedIndex` | < 3400ms |
| `tbt` | ms | `metrics.totalBlockingTime` | < 200ms |
| `render_blocking_req` | count | `render-blocking-resources` / `render-blocking-insight` audit items | 0 |
| `unused_js_estimate` | KB | sum of `unused-javascript` audit `details.items[*].wastedBytes` | — |

- **Speed Index**: How quickly the visible page area is filled in during load. Measures visual progress, not just individual events.
- **TBT** (Total Blocking Time): Total time the browser's main thread was blocked by JavaScript, preventing user interaction between FCP and TTI.
- **Render-blocking requests**: Count of scripts and stylesheets that block the browser from painting until they finish downloading. Each one delays FCP.
- **Unused JS estimate**: Total bytes of JavaScript that were loaded but not executed during page load, summed across all scripts Lighthouse flagged. Stored in KB.

### Resource Weights

All values are transfer sizes (compressed bytes over the wire), converted to KB.

| Column | Unit | Lighthouse source |
|---|---|---|
| `bundle_size` | KB | `total-byte-weight` audit |
| `js_byte_weight` | KB | `resource-summary` items where `resourceType = "script"` |
| `css_byte_weight` | KB | `resource-summary` items where `resourceType = "stylesheet"` |
| `image_byte_weight` | KB | `resource-summary` items where `resourceType = "image"` |
| `font_byte_weight` | KB | `resource-summary` items where `resourceType = "font"` |

**Note:** `resource-summary` reports `transferSize`, which reflects compressed network bytes. Resources served from cache or a service worker may show `0` even if they were used — this is a Lighthouse limitation, not a bug in the extractor.
