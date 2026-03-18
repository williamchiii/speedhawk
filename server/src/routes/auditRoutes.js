import express from "express";
import pool from "../config/database.js"
import logger from "../utils/logger.js"

const router = express.Router();

//Creates a new audit /api/audits
router.post('/', async (req, res) => {
    try{
        const { url } = req.body;
        //TODO: add URL validation here
        
        //Create pending audit in the database
        const result = await pool.query(
            'INSERT INTO audits (url, status) VALUES ($1, $2) RETURNING *',
            [url, 'pending']
        );
        const audit = result.rows[0];

        //TODO: Push job queue to Redis 
        logger.info(`Created audit ${audit.id} for ${url}`);

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
});

//Get audit by ID /api/audits/id
router.get("/:id", async (req, res) => {
    try{
        const { id } = req.params;
        const result = await pool.query(
            'SELECT * FROM audits WHERE id = $1', [id]
        );
        if (result.rows.length === 0){
            return res.status(404).json({
                success: false,
                error: 'Audit not found'
            });
        }
        const audit = result.rows[0];
        res.json({
            success: true,
            audit
        });
    } catch(err){
        logger.error(`Error fetching audit: ${err}`);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch audit'
        });
    }
});

export default router;