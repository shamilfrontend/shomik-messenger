import { Router } from 'express';
import { 
  getChats, 
  createChat, 
  getChatById, 
  addParticipants, 
  removeParticipants,
  updateGroupName,
  updateGroupAvatar,
  leaveGroup,
  deleteChat,
  getChatMessages, 
  sendMessage,
  toggleReaction,
  deleteMessage
} from '../controllers/chat.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getChats);
router.post('/', createChat);
router.get('/:id', getChatById);
router.post('/:id/participants', addParticipants);
router.delete('/:id/participants', removeParticipants);
router.patch('/:id/name', updateGroupName);
router.patch('/:id/avatar', updateGroupAvatar);
router.post('/:id/leave', leaveGroup);
router.delete('/:id', deleteChat);
router.get('/:id/messages', getChatMessages);
router.post('/:id/messages', sendMessage);
router.delete('/:id/messages/:messageId', deleteMessage);
router.post('/:id/messages/:messageId/reactions', toggleReaction);

export default router;
