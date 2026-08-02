import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret';

export type UserType = 'tutor' | 'admin' | 'veterinario' | 'medico';

export interface AuthRequest extends Request {
  userId?: string;
  userType?: UserType;
  /** @deprecated use userId */
  tutorId?: string;
}

interface JwtPayload {
  id: string;
  email: string;
  type: UserType;
  status?: 'pending' | 'active' | 'rejected' | 'suspended';
}

/**
 * Extrai o access token: primeiro do cookie httpOnly `cv_access` (fluxo web
 * padrão), com fallback para o header `Authorization: Bearer` (clientes não
 * baseados em cookie, ex.: integrações/testes).
 */
function extractToken(req: AuthRequest): string | null {
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.cv_access;
  if (cookieToken) return cookieToken;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);

  return null;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Acesso não autorizado. Token não fornecido.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    // Tokens emitidos antes da introdução do status não possuem esse campo e
    // continuam válidos até expirarem. Tokens novos só operam quando ativos.
    if (payload.status && payload.status !== 'active') {
      return res.status(403).json({ error: 'Esta conta não está ativa.' });
    }
    req.userId = payload.id;
    req.userType = payload.type;
    req.tutorId = payload.id;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.userType !== 'admin') {
      return res.status(403).json({ error: 'Acesso restrito a administradores.' });
    }
    next();
  });
}

export function requireVet(req: AuthRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    // O administrador também pode atuar como veterinário.
    if (req.userType !== 'veterinario' && req.userType !== 'admin') {
      return res.status(403).json({ error: 'Acesso restrito a veterinários.' });
    }
    next();
  });
}

export function requireMedico(req: AuthRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.userType !== 'medico' && req.userType !== 'admin') {
      return res.status(403).json({ error: 'Acesso restrito a médicos.' });
    }
    next();
  });
}
