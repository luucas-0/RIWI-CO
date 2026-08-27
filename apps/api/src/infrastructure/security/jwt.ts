import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/env.js';

export type JwtPayload = {
  sub: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
};

export function signAccessToken(payload: JwtPayload) {
  const { sub, email, role } = payload;
  return jwt.sign({ sub, email, role }, config.jwtSecret, { expiresIn: '15m' });
}

export function signRefreshToken(payload: JwtPayload) {
  const { sub, email, role } = payload;
  return jwt.sign({ sub, email, role }, config.jwtRefreshSecret, { expiresIn: '7d', jwtid: crypto.randomUUID() });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtRefreshSecret) as JwtPayload;
}
