import { Router } from 'express';
import { getCatalogs, createCatalog, updateCatalog, deleteCatalog } from '@/controllers/evaluationCatalogController';

const router = Router();

router.get('/', getCatalogs);
router.post('/', createCatalog);
router.put('/:id', updateCatalog);
router.delete('/:id', deleteCatalog);

export default router;
