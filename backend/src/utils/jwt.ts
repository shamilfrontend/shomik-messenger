import jwt, { SignOptions } from 'jsonwebtoken';
import { getJwtSecret } from '../config/env';

const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';

export interface JWTPayload {
  userId: string;
  username: string;
}

export const generateToken = (payload: JWTPayload): string => jwt.sign(payload, getJwtSecret(), {
  expiresIn: JWT_EXPIRES_IN,
} as SignOptions);

export const verifyToken = (token: string): JWTPayload => jwt.verify(token, getJwtSecret()) as JWTPayload;
