import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret';

export type UserType = 'tutor' | 'admin' | 'veterinario';

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
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acesso não autorizado. Token não fornecido.' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
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
