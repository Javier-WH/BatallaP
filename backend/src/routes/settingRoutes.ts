import { Router } from 'express';
import { getSettings, updateSettings, getSettingByKey } from '@/controllers/settingController';

const router = Router();

router.get('/', getSettings);
router.post('/', updateSettings);
router.get('/:key', getSettingByKey);

export default router;
