import { invalidateByTag } from '@vercel/functions';
import { STUDENT_PHOTOS_TAG, STUDENT_ROSTERS_TAG } from './_cache-utils.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', message: `Method ${req.method} not allowed` });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  }

  try {
    await invalidateByTag([STUDENT_ROSTERS_TAG, STUDENT_PHOTOS_TAG]);
    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('[refresh-cache] Cache invalidation failed:', err);
    return res.status(500).json({ status: 'error', message: 'Cache refresh failed' });
  }
}
