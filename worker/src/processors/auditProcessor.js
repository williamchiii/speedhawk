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
    //update audti status to running
    await pool.query("UPDATE audits SET status = $1 WHERE id = $2", [
      "running",
      auditId,
    ]);

    //launch headless browser and run lighthouse
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
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

    console.log(
      `[Job ${job.id}] Score: ${score}, TTFB: ${ttfb}ms, FCP: ${fcp}ms, LCP: ${lcp}ms, Total: ${bundleSize}KB`,
    );

    //save metrics to database
    await pool.query(
      "INSERT INTO metrics (audit_id, ttfb, fcp, lcp, bundle_size) VALUES ($1, $2, $3, $4, $5)",
      [auditId, ttfb, fcp, lcp, bundleSize],
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
    // Mark audit as failed
    await pool.query("UPDATE audits SET status = $1 WHERE id = $2", [
      "failed",
      auditId,
    ]);

    throw err; // BullMQ will retry based on settings
  }
}
