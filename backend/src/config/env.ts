import dotenv from 'dotenv';
import path from 'path';

const loadPrefixedEnv = (): void => {
  const envPrefix = process.env.NODE_ENV === 'production' ? 'PROD_' : 'DEV_';
  if (process.env[`${envPrefix}MONGODB_URI`]) {
    process.env.MONGODB_URI = process.env.MONGODB_URI || process.env[`${envPrefix}MONGODB_URI`];
    process.env.PORT = process.env.PORT || process.env[`${envPrefix}PORT`];
    process.env.JWT_SECRET = process.env.JWT_SECRET || process.env[`${envPrefix}JWT_SECRET`];
    process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || process.env[`${envPrefix}JWT_EXPIRES_IN`];
    process.env.FRONTEND_URL = process.env.FRONTEND_URL || process.env[`${envPrefix}FRONTEND_URL`];
  }
};

if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
  const rootEnvPath = path.resolve(__dirname, '../../../.env');
  dotenv.config({ path: rootEnvPath });
  loadPrefixedEnv();
}

export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET не задан. Укажите переменную окружения JWT_SECRET.');
  }
  return secret;
};

export const getMongoUri = (): string => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI не задан. Укажите переменную окружения MONGODB_URI.');
  }
  return uri;
};

export const getFrontendOrigin = (): boolean | string | string[] => {
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }
  const url = process.env.FRONTEND_URL;
  if (!url) return false;
  return url.split(',').map((item) => item.trim()).filter(Boolean);
};
