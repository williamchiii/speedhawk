import express from "express";
import {
    createAudit,
    getAudit,
} from "../controllers/auditController.js";
import { strictRateLimiter, generousRateLimiter } from "../middlewares/rateLimiter.js";
const router = express.Router();

//CREATE audit
router.post("/", strictRateLimiter, createAudit);

//READ audit by ID
router.get("/:id", generousRateLimiter, getAudit);

export default router;
