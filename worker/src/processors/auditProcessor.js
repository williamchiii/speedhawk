import lighthouse from "lighthouse";
import puppeteer from "puppeteer";
import pool from "../config/database.js";
import { GoogleGenAI } from "@google/genai";
import { validateSuggestions, getFallbackSuggestions } from "../utils/validateSuggestions.js";
import "dotenv/config";

export async function processAudit(job) {
  const { auditId, url } = job.data;

  console.log(`[Job ${job.id}] Processing audit ${auditId} for ${url}`);  
  try {
    // Clean up any partial data from a previous attempt before retrying
    await pool.query("DELETE FROM suggestions WHERE audit_id = $1", [auditId]);
    await pool.query("DELETE FROM metrics WHERE audit_id = $1", [auditId]);

    //update audit status to running
    await pool.query("UPDATE audits SET status = $1 WHERE id = $2", [
      "running",
      auditId,
    ]);

    //launch headless browser and run lighthouse
    const browser = await puppeteer.launch({
      executablePath: process.env.CHROME_BIN || "/usr/bin/chromium",
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const { lhr } = await lighthouse(url, {
      port: new URL(browser.wsEndpoint()).port,
      output: "json",
      onlyCategories: ["performance"],
    });

    await browser.close();

    //Extract metrics from lighthouse results
    const score = Math.round(lhr.categories.performance.score * 100);
    const metrics = lhr.audits.metrics.details.items[0];

    const ttfb = Math.round(
      lhr.audits["server-response-time"]?.numericValue || 0,
    );
    const fcp = Math.round(metrics.firstContentfulPaint);
    const lcp = Math.round(metrics.largestContentfulPaint);

    //get bundle and image sizes (convert bytes to KB)
    const bundleSize = Math.round(
      (lhr.audits["total-byte-weight"]?.numericValue || 0) / 1024,
    );

    // Extract expanded metrics
    const cls = lhr.audits["cumulative-layout-shift"]?.numericValue ?? null;
    const speedIndex = metrics.speedIndex != null ? Math.round(metrics.speedIndex) : null;
    const tbt = metrics.totalBlockingTime != null ? Math.round(metrics.totalBlockingTime) : null;
    const renderBlockingReq = lhr.audits["render-blocking-resources"]?.details?.items?.length ?? null;
    const unusedJsEstimate = lhr.audits["unused-javascript"]?.numericValue != null
      ? Math.round(lhr.audits["unused-javascript"].numericValue / 1024)
      : null;

    // Byte weights by resource type from resource-summary audit (convert bytes to KB)
    const resourceItems = lhr.audits["resource-summary"]?.details?.items ?? [];
    const resourceByType = Object.fromEntries(resourceItems.map((item) => [item.resourceType, item]));
    const jsBytes = resourceByType["script"]?.transferSize != null ? Math.round(resourceByType["script"].transferSize / 1024) : null;
    const cssBytes = resourceByType["stylesheet"]?.transferSize != null ? Math.round(resourceByType["stylesheet"].transferSize / 1024) : null;
    const imageBytes = resourceByType["image"]?.transferSize != null ? Math.round(resourceByType["image"].transferSize / 1024) : null;
    const fontBytes = resourceByType["font"]?.transferSize != null ? Math.round(resourceByType["font"].transferSize / 1024) : null;

    console.log(
      `[Job ${job.id}] Score: ${score}, TTFB: ${ttfb}ms, FCP: ${fcp}ms, LCP: ${lcp}ms, Total: ${bundleSize}KB, CLS: ${cls}, TBT: ${tbt}ms`,
    );

    //save metrics to database
    await pool.query(
      `INSERT INTO metrics (
        audit_id, ttfb, fcp, lcp, bundle_size,
        cls, speed_index, tbt,
        js_byte_weight, css_byte_weight, image_byte_weight, font_byte_weight,
        render_blocking_req, unused_js_estimate
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [auditId, ttfb, fcp, lcp, bundleSize, cls, speedIndex, tbt, jsBytes, cssBytes, imageBytes, fontBytes, renderBlockingReq, unusedJsEstimate],
    );

    //generate suggestions based on the performance thresholds with Google Gemini
    const suggestions = [];
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }); //automatically gets GEMINI_API_KEY from .env
      const prompt = `You are a web performance expert. Analyze these metrics and generate 2-4 specific, actionable suggestions:

        Performance Score: ${score}/100
        TTFB: ${ttfb}ms (good: <800ms)
        FCP: ${fcp}ms (good: <1800ms)  
        LCP: ${lcp}ms (good: <2500ms)
        Total Page Weight: ${bundleSize}KB

        CRITICAL: You MUST return a valid JSON array. Each object MUST have exactly these three fields:
        - "type": string (one of: "performance", "bundle", "image", "rendering")
        - "message": string (specific, actionable suggestion)
        - "impact": string (one of: "high", "medium", "low")

        Return ONLY the JSON array, no markdown, no explanations, no code blocks.`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      const aiResponse = result.text.trim();
      const cleanResponse = aiResponse
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "");
      const aiSuggestions = JSON.parse(cleanResponse);
      const validSuggestions = validateSuggestions(aiSuggestions, job.id);

      if (validSuggestions.length > 0) {
        suggestions.push(...validSuggestions);
        console.log(
          `[Job ${job.id}] Using ${validSuggestions.length} AI-generated suggestions`,
        );
      } else {
        throw new Error("No valid suggestions from AI");
      }
    } catch (err) {
      console.error("Gemini API error. Possibly exceeded rate limit");
      console.error(err);
      // Fallback to rule-based suggestions if AI fails
      // Use rule-based fallback
      const fallbackSuggestions = getFallbackSuggestions({
        score,
        ttfb,
        fcp,
        lcp,
        bundleSize,
      });
      suggestions.push(...fallbackSuggestions);
    }

    //save sugestions to databse
    for (const suggestion of suggestions) {
      await pool.query(
        "INSERT INTO suggestions (audit_id, type, message, impact) VALUES ($1, $2, $3, $4)",
        [auditId, suggestion.type, suggestion.message, suggestion.impact],
      );
    }

    //mark audit as complete
    await pool.query(
      "UPDATE audits SET status = $1, score = $2, completed_at = NOW() WHERE id = $3",
      ["complete", score, auditId],
    );

    console.log(`[Job ${job.id}] Audit ${auditId} completed successfully`);
  } catch (err) {
    console.error(`[Job ${job.id}] Error processing audit ${auditId}:`, err);

    const maxAttempts = job.opts.attempts || 1; //opts is built in BullMQ parameter
    const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;

    if (isLastAttempt) {
      // All retries exhausted. mark as terminal failure
      await pool.query("UPDATE audits SET status = $1 WHERE id = $2", [
        "failed",
        auditId,
      ]);
    } else {
      // Retries remain — revert to pending so the client keeps polling
      await pool.query("UPDATE audits SET status = $1 WHERE id = $2", [
        "pending",
        auditId,
      ]);
      console.log(
        `[Job ${job.id}] Attempt ${job.attemptsMade + 1}/${maxAttempts} failed, will retry`,
      );
    }

    throw err; // BullMQ may retry based on settings
  }
}
