import { verifyToken } from '../utils/jwt';
import User from '../models/User.model';
import { WebSocket } from 'ws';

export interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  user?: any;
}

export const authenticateWebSocket = async (
  ws: AuthenticatedWebSocket,
  token: string
): Promise<boolean> => {
  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return false;
    }

    ws.userId = decoded.userId;
    ws.user = user;
    return true;
  } catch (error) {
    return false;
  }
};
