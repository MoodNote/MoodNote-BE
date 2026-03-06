import { Router } from 'express';
import authRoutes from './auth.routes';
import entryRoutes from './entry.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/entries', entryRoutes);

export default router;
