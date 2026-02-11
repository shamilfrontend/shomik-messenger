import { Router } from 'express';
import {
  searchUsers, getUserById, updateProfile, changePassword,
} from '../controllers/user.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/search', searchUsers);
router.get('/:id', getUserById);
router.put('/profile', updateProfile);
router.put('/password', changePassword);

export default router;
