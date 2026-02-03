import { Router } from 'express';
import { upload, getFileUrl } from '../utils/upload';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { Response } from 'express';

const router = Router();

router.use(authMiddleware);

router.post('/file', upload.single('file'), (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Файл не загружен' });
      return;
    }

    const fileUrl = getFileUrl(req.file.filename);
    const fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'file';

    res.json({
      url: fileUrl,
      filename: req.file.originalname,
      type: fileType,
      size: req.file.size
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
