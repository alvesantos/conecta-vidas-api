import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { userService } from '../services/user.service';
import { petService } from '../services/pet.service';
import logger from '../logger';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d';

function signToken(user: { id: string; email: string; type: string }) {
  return jwt.sign(
    { id: user.id, email: user.email, type: user.type },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );
}

export const authController = {
  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
      }

      const user = await userService.login({ email, password });
      const token = signToken(user);

      return res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          type: user.type,
        },
      });
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
        password,
        pet,
      } = req.body as Record<string, unknown>;

      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
      }

      const user = await userService.create({
        name: name as string,
        cpf: (cpf as string | undefined) ?? null,
        email: email as string,
        address: (address as string | undefined) ?? null,
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

      const token = signToken(user);

      return res.status(201).json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          type: user.type,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar conta.';
      logger.error('Erro ao registrar usuário', { message: err instanceof Error ? err.message : message, stack: err instanceof Error ? err.stack : undefined, email: (req.body as Record<string, unknown>)?.email });
      return res.status(400).json({ error: message });
    }
  },
};
