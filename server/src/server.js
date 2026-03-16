//this file is what runs when you run the server
import express from "express";
import cors from "cors";
import logger from "./utils/logger.js"
import dotenv from "dotenv";

//this creates the main express app
const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
    res.json({status: "ok", service: "server"});
});

app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});