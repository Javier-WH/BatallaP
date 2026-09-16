"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stream = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Ensure logs directory exists
const logsDir = path_1.default.join(__dirname, '..', '..', 'logs');
if (!fs_1.default.existsSync(logsDir)) {
    fs_1.default.mkdirSync(logsDir, { recursive: true });
}
const { combine, timestamp, printf, colorize, errors, json } = winston_1.default.format;
// Filter to only allow a specific level in a transport
const levelFilter = (targetLevel) => winston_1.default.format((info) => (info.level === targetLevel ? info : false))();
// Custom log format for console (human-readable)
const consoleFormat = combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), printf((_a) => {
    var { timestamp, level, message } = _a, meta = __rest(_a, ["timestamp", "level", "message"]);
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${message}${metaStr}`;
}));
// Custom log format for files (structured JSON)
const fileFormat = combine(timestamp(), errors({ stack: true }), json());
// Error transport — only error level, 30 days retention
const errorTransport = new winston_daily_rotate_file_1.default({
    dirname: logsDir,
    filename: 'error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxFiles: '30d',
    maxSize: '20m',
    format: fileFormat,
});
// Combined transport — all levels (info+), 14 days retention
const combinedTransport = new winston_daily_rotate_file_1.default({
    dirname: logsDir,
    filename: 'combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: '14d',
    maxSize: '20m',
    format: fileFormat,
});
// HTTP transport — only http level (filtered), 7 days retention
const httpTransport = new winston_daily_rotate_file_1.default({
    dirname: logsDir,
    filename: 'http-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    level: 'http',
    maxFiles: '7d',
    maxSize: '20m',
    format: combine(levelFilter('http'), fileFormat),
});
// Console transport — only in non-test environments
const isTest = process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;
const consoleTransport = new winston_1.default.transports.Console({
    level: isTest ? 'error' : 'debug',
    format: consoleFormat,
    silent: isTest,
});
// Main logger
exports.logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    levels: {
        error: 0,
        warn: 1,
        info: 2,
        http: 3,
        debug: 4,
    },
    format: fileFormat,
    transports: [
        errorTransport,
        combinedTransport,
        httpTransport,
        consoleTransport,
    ],
    exitOnError: false,
});
// Stream for morgan HTTP logging
exports.stream = {
    write: (message) => {
        exports.logger.http(message.trim());
    },
};
exports.default = exports.logger;
