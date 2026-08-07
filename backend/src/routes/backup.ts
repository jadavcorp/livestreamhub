import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { createBackup, listBackups, restoreBackup, deleteBackup } from '../services/backup';
import { BACKUPS_DIR } from '../db';
import path from 'path';

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => {
  res.json({ backups: listBackups() });
});

router.post('/', async (req, res) => {
  const { includeVideos = true, includeThumbnails = true, includeDatabase = true, includeSettings = true } = req.body || {};
  try {
    const info = await createBackup({ includeVideos, includeThumbnails, includeDatabase, includeSettings });
    res.json({ backup: info });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:filename/restore', async (req, res) => {
  try {
    await restoreBackup(req.params.filename);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:filename', (req, res) => {
  deleteBackup(req.params.filename);
  res.json({ success: true });
});

router.get('/:filename/download', (req, res) => {
  const file = path.join(BACKUPS_DIR, req.params.filename);
  res.download(file);
});

export default router;
