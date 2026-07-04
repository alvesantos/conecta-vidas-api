import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import multer from 'multer';
import routes from './routes';
import logger from './logger';

const app = express();

// `credentials: true` é obrigatório para o navegador enviar/receber os
// cookies httpOnly de sessão. Com credenciais, o origin não pode ser '*'.
app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Servir uploads (avatars de pets, etc.) como arquivos estáticos
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

app.get('/api/hello', (_req, res) => {
  res.json({ message: 'Hello from ConectaVet API!' });
});

app.use('/api', routes);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Arquivo muito grande. Tamanho máximo: 5 MB.'
      : err.message;
    logger.error('Erro de upload (multer)', { code: err.code, message: err.message, field: err.field, url: req.originalUrl });
    return res.status(400).json({ error: message });
  }

  const message = err instanceof Error ? err.message : 'Erro interno do servidor.';
  logger.error('Erro não tratado', { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined, url: req.originalUrl, method: req.method });
  return res.status(500).json({ error: message });
});

export default app;
