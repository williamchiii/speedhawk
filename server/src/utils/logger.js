//This file sets up the winston logger for better console.logs
import winston from "winston";

const logLevels = {
    critical: 0, //highest priority
    error: 1,
    info: 2, //lowest priority
};

const logColors = {
    critical: "red",
    error: "yellow",
    info: "green",
};

winston.addColors(logColors);

const logger = winston.createLogger({
    levels: logLevels,
    level: process.env.LOG_LEVEL || "info",
    transports: [
        new winston.transports.Console({
            format: process.env.NODE_ENV === "production" 
            ? winston.format.json()
            : winston.format.combine(winston.format.colorize(), winston.format.simple())
        })
    ]
});

export default logger;