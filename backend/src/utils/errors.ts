import { Response } from 'express';

export const INTERNAL_ERROR = 'Внутренняя ошибка сервера';

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export const sendHttpError = (res: Response, error: unknown): boolean => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  const status = (error as { status?: number }).status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    res.status(status).json({ error: (error as Error).message });
    return true;
  }
  return false;
};

export const sendInternalError = (res: Response, error: unknown, context?: string): void => {
  if (sendHttpError(res, error)) return;
  if (context) {
    console.error(context, error);
  } else {
    console.error(error);
  }
  res.status(500).json({ error: INTERNAL_ERROR });
};
