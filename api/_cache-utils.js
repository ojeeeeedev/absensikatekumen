import { storageBaseNameForStudent } from './_supabase-utils.js';

export const STUDENT_ROSTERS_TAG = 'student-rosters';
export const STUDENT_PHOTOS_TAG = 'student-photos';

export function studentRosterTag(classCode) {
  return `student-roster-${String(classCode).trim().toLowerCase()}`;
}

export function studentPhotoTag(studentId) {
  const baseName = storageBaseNameForStudent(studentId);
  return baseName ? `student-photo-${baseName.toLowerCase()}` : null;
}

export function setCdnCacheHeaders(res, tags) {
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=31536000');
  res.setHeader('Vercel-Cache-Tag', tags.filter(Boolean).join(','));
}
