import type { Request, Response, CookieOptions } from 'express';
import jwt from 'jsonwebtoken';
import { userService } from '../services/user.service';
import { petService } from '../services/pet.service';
import { refreshTokenService } from '../services/refreshToken.service';
import logger from '../logger';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret';
// Access token curto: o refresh token o renova de forma transparente.
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL ?? '15m';

const ACCESS_COOKIE = 'cv_access';
const REFRESH_COOKIE = 'cv_refresh';
// O refresh token só trafega nas rotas de auth (login/refresh/logout),
// reduzindo a superfície de exposição.
const REFRESH_COOKIE_PATH = '/api/auth';

interface PublicUser {
  id: string;
  name: string;
  email: string;
  type: string;
  crmv?: string | null;
  crm?: string | null;
  status?: string;
}

type PortalKey = 'cliente' | 'medico' | 'veterinario' | 'adm';

const PORTAL_ACCESS: Record<PortalKey, { label: string; types: string[] }> = {
  cliente: { label: 'Cliente', types: ['tutor', 'admin'] },
  medico: { label: 'Médico', types: ['medico', 'admin'] },
  veterinario: { label: 'Veterinário', types: ['veterinario', 'admin'] },
  adm: { label: 'Administrativo', types: ['admin'] },
};

function signAccessToken(user: { id: string; email: string; type: string; status?: string }) {
  return jwt.sign(
    { id: user.id, email: user.email, type: user.type, status: user.status ?? 'active' },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL } as jwt.SignOptions
  );
}

function toPublicUser(user: Record<string, unknown>): PublicUser {
  return {
    id: user.id as string,
    name: user.name as string,
    email: user.email as string,
    type: user.type as string,
    crmv: (user.crmv as string | undefined) ?? null,
    crm: (user.crm as string | undefined) ?? null,
    status: (user.status as string | undefined) ?? 'active',
  };
}

/**
 * Base das opções de cookie. `secure`/`sameSite`/`domain` são configuráveis
 * por env para suportar front e API em domínios diferentes em produção
 * (SameSite=None + Secure), mantendo Lax em desenvolvimento (localhost).
 */
function baseCookieOptions(): CookieOptions {
  const sameSite = (process.env.COOKIE_SAMESITE ?? 'lax') as CookieOptions['sameSite'];
  const secure = process.env.COOKIE_SECURE === 'true';
  const domain = process.env.COOKIE_DOMAIN || undefined;
  return { httpOnly: true, sameSite, secure, domain };
}

function setAuthCookies(res: Response, accessToken: string, refreshToken: string, refreshExpires: Date) {
  const base = baseCookieOptions();
  // Access: enviado a toda a API.
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...base,
    path: '/',
    // Espelha o TTL do JWT em milissegundos para o cookie do access token.
    maxAge: 15 * 60 * 1000,
  });
  // Refresh: escopo restrito às rotas de auth.
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...base,
    path: REFRESH_COOKIE_PATH,
    expires: refreshExpires,
  });
}

function clearAuthCookies(res: Response) {
  const base = baseCookieOptions();
  res.clearCookie(ACCESS_COOKIE, { ...base, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base, path: REFRESH_COOKIE_PATH });
}

/** Emite access + refresh, grava os cookies e devolve o usuário no corpo. */
async function issueSession(res: Response, user: PublicUser) {
  const accessToken = signAccessToken(user);
  const refresh = await refreshTokenService.issue(user.id);
  setAuthCookies(res, accessToken, refresh.raw, refresh.expiresAt);
}

export const authController = {
  async login(req: Request, res: Response) {
    try {
      const { email, password, portal } = req.body as {
        email?: string;
        password?: string;
        portal?: PortalKey;
      };

      if (!email || !password) {
        return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
      }

      const user = await userService.login({ email, password });
      const status = (user.status as string | undefined) ?? 'active';
      if (status !== 'active') {
        const codes: Record<string, string> = {
          pending: 'ACCOUNT_PENDING',
          rejected: 'ACCOUNT_REJECTED',
          suspended: 'ACCOUNT_SUSPENDED',
        };
        return res.status(403).json({
          error: 'Esta conta não está ativa.',
          code: codes[status] ?? 'ACCOUNT_INACTIVE',
          reason: user.status_reason ?? null,
        });
      }

      if (portal) {
        const access = PORTAL_ACCESS[portal];
        if (!access) {
          return res.status(400).json({ error: 'Portal inválido.' });
        }
        if (!access.types.includes(user.type as string)) {
          return res.status(403).json({
            error: `Esta conta não tem acesso ao portal ${access.label}.`,
          });
        }
      }

      const publicUser = toPublicUser(user);
      await issueSession(res, publicUser);

      return res.json({ user: publicUser });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao fazer login.';
      logger.error('Erro ao fazer login', { message: err instanceof Error ? err.message : message, stack: err instanceof Error ? err.stack : undefined, email: req.body?.email });
      return res.status(401).json({ error: message });
    }
  },

  async register(req: Request, res: Response) {
    try {
      const {
        name,
        cpf,
        email,
        address,
        zip_code,
        house_number,
        phone,
        birth_date,
        biological_sex,
        password,
        pet,
      } = req.body as Record<string, unknown>;

      if (!name || !cpf || !email || !password) {
        return res.status(400).json({ error: 'Nome, CPF, e-mail e senha são obrigatórios.' });
      }

      const user = await userService.create({
        name: name as string,
        cpf: (cpf as string | undefined) ?? null,
        email: email as string,
        address: (address as string | undefined) ?? null,
        zip_code: (zip_code as string | undefined) ?? null,
        house_number: (house_number as string | undefined) ?? null,
        phone: (phone as string | undefined) ?? null,
        birth_date: (birth_date as string | undefined) ?? null,
        biological_sex: (biological_sex as 'feminino' | 'masculino' | 'intersexo' | 'nao_informado' | undefined) ?? null,
        password: password as string,
        type: 'tutor',
      });

      if (pet && typeof pet === 'object') {
        const petData = pet as Record<string, unknown>;
        await petService.create({
          user_id: user.id,
          name: petData.name as string,
          species: petData.species as string,
          breed: petData.breed as string,
          size: petData.size as string,
          coat: petData.coat as string,
          coat_color: (petData.coat_color as string | undefined) || undefined,
          birth_date: petData.birth_date as string,
          microchipped: petData.microchipped === true || petData.microchipped === 'true',
          neutered: petData.neutered === true || petData.neutered === 'true',
          behavior: (petData.behavior as string | undefined) || undefined,
          conditions: (petData.conditions as string | undefined) || undefined,
        });
      }

      const publicUser = toPublicUser(user);
      await issueSession(res, publicUser);

      return res.status(201).json({ user: publicUser });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar conta.';
      logger.error('Erro ao registrar usuário', { message: err instanceof Error ? err.message : message, stack: err instanceof Error ? err.stack : undefined, email: (req.body as Record<string, unknown>)?.email });
      return res.status(400).json({ error: message });
    }
  },

  async registerProfessional(req: Request, res: Response) {
    try {
      const {
        type, name, cpf, email, phone, password, crm, crmv,
        address, zip_code, house_number,
      } = req.body as Record<string, string>;

      if (type !== 'medico' && type !== 'veterinario') {
        return res.status(400).json({ error: 'Tipo profissional inválido.' });
      }
      if (!name || !cpf || !email || !phone || !password) {
        return res.status(400).json({
          error: 'Nome, CPF, e-mail, telefone e senha são obrigatórios.',
        });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
      }
      if (type === 'medico' && !crm) {
        return res.status(400).json({ error: 'CRM é obrigatório para médicos.' });
      }
      if (type === 'veterinario' && !crmv) {
        return res.status(400).json({ error: 'CRMV é obrigatório para veterinários.' });
      }

      await userService.create({
        type,
        name,
        cpf,
        email,
        phone,
        password,
        crm: type === 'medico' ? crm : null,
        crmv: type === 'veterinario' ? crmv : null,
        address: address || null,
        zip_code: zip_code || null,
        house_number: house_number || null,
        status: 'pending',
      });

      return res.status(201).json({
        message: 'Cadastro recebido e enviado para análise.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar cadastro profissional.';
      logger.error('Erro ao registrar profissional', {
        message,
        stack: err instanceof Error ? err.stack : undefined,
        email: req.body?.email,
      });
      return res.status(400).json({ error: message });
    }
  },

  /**
   * Renova a sessão a partir do refresh token (cookie httpOnly).
   * Faz rotação: o token usado é revogado e um novo é emitido.
   */
  async refresh(req: Request, res: Response) {
    try {
      const raw = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? '';
      const valid = await refreshTokenService.verify(raw);

      if (!valid) {
        clearAuthCookies(res);
        return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
      }

      const user = await userService.findById(valid.userId);
      if (!user) {
        // Usuário removido enquanto tinha sessão ativa.
        await refreshTokenService.revokeById(valid.id);
        clearAuthCookies(res);
        return res.status(401).json({ error: 'Sessão inválida.' });
      }

      const publicUser = toPublicUser(user);
      if (publicUser.status !== 'active') {
        await refreshTokenService.revokeById(valid.id);
        clearAuthCookies(res);
        return res.status(403).json({ error: 'Esta conta não está ativa.' });
      }
      const accessToken = signAccessToken(publicUser);
      const rotated = await refreshTokenService.rotate(valid.id, valid.userId);
      setAuthCookies(res, accessToken, rotated.raw, rotated.expiresAt);

      return res.json({ user: publicUser });
    } catch (err) {
      logger.error('Erro ao renovar sessão', { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined });
      clearAuthCookies(res);
      return res.status(401).json({ error: 'Não foi possível renovar a sessão.' });
    }
  },

  /** Encerra a sessão: revoga o refresh token e limpa os cookies. */
  async logout(req: Request, res: Response) {
    try {
      const raw = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? '';
      if (raw) await refreshTokenService.revokeRaw(raw);
    } catch (err) {
      logger.error('Erro ao encerrar sessão', { message: err instanceof Error ? err.message : String(err) });
    }
    clearAuthCookies(res);
    return res.status(204).end();
  },
};
