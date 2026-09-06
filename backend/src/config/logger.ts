import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Filter to only allow a specific level in a transport
const levelFilter = (targetLevel: string) =>
  winston.format((info) => (info.level === targetLevel ? info : false))();

// Custom log format for console (human-readable)
const consoleFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${message}${metaStr}`;
  })
);

// Custom log format for files (structured JSON)
const fileFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

// Error transport — only error level, 30 days retention
const errorTransport = new DailyRotateFile({
  dirname: logsDir,
  filename: 'error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxFiles: '30d',
  maxSize: '20m',
  format: fileFormat,
});

// Combined transport — all levels (info+), 14 days retention
const combinedTransport = new DailyRotateFile({
  dirname: logsDir,
  filename: 'combined-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxFiles: '14d',
  maxSize: '20m',
  format: fileFormat,
});

// HTTP transport — only http level (filtered), 7 days retention
const httpTransport = new DailyRotateFile({
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
const consoleTransport = new winston.transports.Console({
  level: isTest ? 'error' : 'debug',
  format: consoleFormat,
  silent: isTest,
});

// Main logger
export const logger = winston.createLogger({
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
export const stream = {
  write: (message: string): void => {
    logger.http(message.trim());
  },
};

export default logger;
