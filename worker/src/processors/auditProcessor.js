import lighthouse from "lighthouse";
import puppeteer from "puppeteer";
import pool from "../config/database.js";
import { GoogleGenAI } from "@google/genai";

export async function processAudit(job){
    const { auditId, url } = job.data;

    console.log(`[Job ${job.id}] Processing audit ${auditId} for ${url}`);

    try{
        //update audti status to running
        await pool.query(
            "UPDATE audits SET status = $1 WHERE id = $2",
            ["running", auditId]
        );

        //launch headless browser and run lighthouse
        const browser = await puppeteer.launch({
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
            headless: true,
        });

        const { lhr } = await lighthouse(url, {
            port: new URL(browser.wsEndpoint()).port,
            output: "json",
            onlyCategories: ["performance"]
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
            `[Job ${job.id}] Score: ${score}, TTFB: ${ttfb}ms, FCP: ${fcp}ms, LCP: ${lcp}ms, Bundle: ${bundleSize}KB`,
        );

        //save metrics to database
        await pool.query(
            "INSERT INTO metrics (audit_id, ttfb, fcp, lcp, bundle_size) VALUES ($1, $2, $3, $4, $5)",
            [auditId, ttfb, fcp, lcp, bundleSize]
        );

        //generate suggestions based on the performance thresholds with Google Gemini
        const suggestions = [];
        try{
            const ai = new GoogleGenAI({}); //automatically gets GEMINI_API_KEY from .env
            const prompt = `You are a web performance expert. Analyze these metrics and generate 2-4 specific, actionable suggestions to improve performance:
                Performance Score: ${score}/100
                TTFB (Time to First Byte): ${ttfb}ms (good: <800ms)
                FCP (First Contentful Paint): ${fcp}ms (good: <1800ms)
                LCP (Largest Contentful Paint): ${lcp}ms (good: <2500ms)
                JavaScript Bundle Size: ${bundleSize}KB

                Return ONLY a JSON array with this exact format (no markdown, no code blocks, no explanation):
                [
                {"type": "performance", "message": "specific suggestion here", "impact": "high"},
                {"type": "bundle", "message": "specific suggestion here", "impact": "medium"}
                ]

                Focus on the worst metrics. Be specific and actionable.`;
            const result = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: prompt,
            });
            const aiResponse = result.text.trim();
            const cleanResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            const aiSuggestions = JSON.parse(cleanResponse);
            suggestions.push(...aiSuggestions);
            console.log(`[Job ${job.id}] Generated ${suggestions.length} AI suggestions via Gemini`);
        } catch(err){
            console.error("Gemini API error. Possibly exceeded rate limit");
            console.error(err)
            // Fallback to rule-based suggestions if AI fails
            if (lcp > 2500) {
                suggestions.push({
                type: 'performance',
                message: 'LCP exceeds recommended threshold. Optimize images and reduce server response time.',
                impact: 'high'
                });
            }
            if (bundleSize > 500) {
                suggestions.push({
                type: 'bundle',
                message: 'JavaScript bundle is large. Consider code splitting and lazy loading.',
                impact: 'medium'
                });
            }
        }
        
        //save sugestions to databse
        for (const suggestion of suggestions){
            await pool.query(
                "INSERT INTO suggestions (audit_id, type, message, impact) VALUES ($1, $2, $3, $4)",
                [auditId, suggestion.type, suggestion.message, suggestion.impact]
            );
        }

        //mark audit as complete
        await pool.query(
            "UPDATE audits SET status = $1, score = $2, completed_at = NOW() WHERE id = $3",
            ["complete", score, auditId]
        );
        
        console.log(`[Job ${job.id}] Audit ${auditId} completed successfully`);
    } catch(err){
        console.error(
            `[Job ${job.id}] Error processing audit ${auditId}:`,
            err,
      );
      // Mark audit as failed
        await pool.query("UPDATE audits SET status = $1 WHERE id = $2",
            ["failed", auditId]);

        throw err; // BullMQ will retry based on settings
    }
};