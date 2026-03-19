//this file is what runs when you run the server
import express from "express";
import cors from "cors";
import logger from "./utils/logger.js"
import "dotenv/config"; 
import auditRoutes from "./routes/auditRoutes.js";

//this creates the main express app
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}));
app.use(express.json());

app.get("/health", (req, res) => {
    res.json({status: "ok", service: "server"});
});

app.use("/api/audits", auditRoutes);

app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});