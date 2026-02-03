import { Router } from 'express';
import { getChats, createChat, getChatById, addParticipants, getChatMessages, sendMessage } from '../controllers/chat.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getChats);
router.post('/', createChat);
router.get('/:id', getChatById);
router.post('/:id/participants', addParticipants);
router.get('/:id/messages', getChatMessages);
router.post('/:id/messages', sendMessage);

export default router;
