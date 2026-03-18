import lighthouse from "lighthouse";
import puppeteer from "puppeteer";
import pool from "../config/database.js";

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

        //generate suggestions based on the performance thresholds
        //TODO: Implement OpenAI integration for the suggestions
        //This is a placeholder for now
        const suggestions = [];
        suggestions.push({
            type: "performance",
            message: "Example message 1",
            impact: "high"
        });
        suggestions.push({
            type: "performance",
            message: "Example message 2",
            impact: "high",
        });
        suggestions.push({
            type: "performance",
            message: "Example message 3",
            impact: "high",
        });

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