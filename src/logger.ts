import winston from 'winston';
import path from 'path';

const logger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const extra = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
      return `[${timestamp}] ${level.toUpperCase()}: ${message} ${extra}`.trim();
    })
  ),
  transports: [
    new winston.transports.File({
      filename: path.resolve(process.cwd(), 'logs/app.log'),
    }),
  ],
});

export default logger;
