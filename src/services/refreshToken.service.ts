import { randomBytes, createHash } from 'crypto';
import { db } from '../database/knex';

/**
 * Vida útil do refresh token (dias). Configurável por env; padrão 30 dias.
 * É a janela em que o usuário permanece logado sem reautenticar.
 */
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30);

/** SHA-256 hex do token opaco — só o hash é persistido. */
function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export interface IssuedRefreshToken {
  /** Valor cru a ser enviado no cookie (nunca persistido). */
  raw: string;
  expiresAt: Date;
}

export const refreshTokenService = {
  /** Emite um novo refresh token para o usuário e persiste apenas o hash. */
  async issue(userId: string): Promise<IssuedRefreshToken> {
    const raw = randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

    await db('refresh_tokens').insert({
      user_id: userId,
      token_hash: hashToken(raw),
      expires_at: expiresAt,
    });

    return { raw, expiresAt };
  },

  /**
   * Valida um refresh token cru. Retorna o `user_id` se o token existir,
   * não estiver revogado e não estiver expirado; caso contrário, null.
   */
  async verify(raw: string): Promise<{ id: string; userId: string } | null> {
    if (!raw) return null;
    const row = await db('refresh_tokens')
      .where({ token_hash: hashToken(raw) })
      .first();

    if (!row) return null;
    if (row.revoked_at) return null;
    if (new Date(row.expires_at).getTime() <= Date.now()) return null;

    return { id: row.id, userId: row.user_id };
  },

  /** Revoga um token específico pelo seu id. */
  async revokeById(id: string): Promise<void> {
    await db('refresh_tokens')
      .where({ id })
      .whereNull('revoked_at')
      .update({ revoked_at: db.fn.now() });
  },

  /** Revoga um token cru (usado no logout a partir do cookie). */
  async revokeRaw(raw: string): Promise<void> {
    if (!raw) return;
    await db('refresh_tokens')
      .where({ token_hash: hashToken(raw) })
      .whereNull('revoked_at')
      .update({ revoked_at: db.fn.now() });
  },

  /**
   * Rotação: revoga o token atual e emite um novo para o mesmo usuário.
   * Retorna o novo token cru + expiração.
   */
  async rotate(currentId: string, userId: string): Promise<IssuedRefreshToken> {
    await this.revokeById(currentId);
    return this.issue(userId);
  },
};
