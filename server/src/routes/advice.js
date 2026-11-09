import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../middleware/index.js';
import { random } from '../controllers/advice.js';

const router = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests. Please try again later.' } });
router.get('/random', limiter, asyncHandler(random));
export default router;
