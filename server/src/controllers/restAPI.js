import pool from "../config/database.js"
import logger from "../utils/logger.js"
import auditQueue from "../config/queue.js";

//CREATE: create a new audit and push job to Redis queue
//Route: POST /api/audits
export async function createAudit(req, res) {
    try{
        const { url } = req.body;
        //TODO: add URL validation here

        //Create pending audit in the database
        const result = await pool.query(
            'INSERT INTO audits (url, status) VALUES ($1, $2) RETURNING *',
            [url, 'pending']
        );
        const audit = result.rows[0];

        //push job to Redis queue
        await auditQueue.add("process-audit", {
            auditId: audit.id,
            url: audit.url
        });

        logger.info(`Created audit ${audit.id} for ${url} and enqueued job`);

        res.status(201).json({
            success: true,
            audit: {
                id: audit.id,
                url: audit.url,
                status: audit.status,
                created_at: audit.created_at
            }
        });
    } catch(err){
        logger.error(`Error creating audit: ${err}`);
        res.status(500).json({
            success: false,
            error: 'Failed to create audit'
        });
    }
}

//READ: get audit by ID with metrics and suggestions
//Route: GET /api/audits/:id
export async function getAudit(req, res) {
    try{
        const { id } = req.params;

        //get audit table
        const auditResult = await pool.query(
            'SELECT * FROM audits WHERE id = $1', [id]
        );
        if (auditResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: "Audit not found",
          });
        }
        const audit = auditResult.rows[0];

        //get metrics table
        const metricsResult = await pool.query(
            'SELECT * FROM metrics WHERE audit_id = $1', [id]
        );

        //get suggestions
        const suggestionsResult = await pool.query(
            'SELECT * FROM suggestions WHERE audit_id = $1', [id]
        );

        //send the response to client
        res.json({
            ...audit,
            metrics: metricsResult.rows[0] || null,
            suggestions: suggestionsResult.rows || []
        });

    } catch(err){
        logger.error(`Error fetching audit: ${err}`);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch audit'
        });
    }
}
