import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export type JwtPayload = {
  sub: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
};

export function signAccessToken(payload: JwtPayload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '15m' });
}

export function signRefreshToken(payload: JwtPayload) {
  return jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtRefreshSecret) as JwtPayload;
}
