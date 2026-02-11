import { Router } from 'express';
import {
  getChats,
  createChat,
  getChatById,
  updatePinnedMessage,
  togglePinChat,
  addParticipants,
  removeParticipants,
  updateGroupName,
  updateGroupAvatar,
  leaveGroup,
  deleteChat,
  getChatMessages,
  sendMessage,
  toggleReaction,
  deleteMessage,
  editMessage,
} from '../controllers/chat.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getChats);
router.post('/', createChat);
router.get('/:id', getChatById);
router.patch('/:id/pinned-message', updatePinnedMessage);
router.patch('/:id/pin', togglePinChat);
router.post('/:id/participants', addParticipants);
router.delete('/:id/participants', removeParticipants);
router.patch('/:id/name', updateGroupName);
router.patch('/:id/avatar', updateGroupAvatar);
router.post('/:id/leave', leaveGroup);
router.delete('/:id', deleteChat);
router.get('/:id/messages', getChatMessages);
router.post('/:id/messages', sendMessage);
router.delete('/:id/messages/:messageId', deleteMessage);
router.patch('/:id/messages/:messageId', editMessage);
router.post('/:id/messages/:messageId/reactions', toggleReaction);

export default router;
