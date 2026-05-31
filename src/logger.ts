import winston from 'winston';
import path from 'path';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const extra = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message} ${extra}`.trim();
  })
);

const logger = winston.createLogger({
  level: 'error',
  format: logFormat,
  transports: [
    new winston.transports.Console({ format: logFormat }),
    new winston.transports.File({
      filename: path.resolve(__dirname, '..', 'logs', 'app.log'),
    }),
  ],
});

export default logger;
