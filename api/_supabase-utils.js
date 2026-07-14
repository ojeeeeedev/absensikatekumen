/**
 * Shared Supabase storage utilities.
 *
 * Extracted so multiple API handlers (upload-photo, init-bucket, etc.)
 * can reuse this logic without duplication.
 */

/**
 * Ensures a Supabase storage bucket exists, creating it if necessary.
 *
 * The bucket is created as private (public: false) so that file access must go
 * through the authenticated same-origin photo proxy.
 *
 * This is idempotent: if the bucket already exists the "already exists"
 * error from Supabase is silently ignored.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} bucketName  e.g. "pasfoto-sab"
 * @returns {Promise<{ created: boolean }>}  true = newly created, false = already existed
 * @throws {Error} if creation fails for any reason other than "already exists"
 */
export async function ensureBucketExists(supabase, bucketName) {
  const { error } = await supabase.storage.createBucket(bucketName, {
    public: false,            // authenticated proxy access only
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    fileSizeLimit: 5 * 1024 * 1024, // 5 MB
  });

  if (!error) {
    console.log(`[supabase-utils] Created new bucket: ${bucketName}`);
    return { created: true };
  }

  // Supabase returns this message when the bucket already exists.
  // Treat it as a non-error so the function is idempotent.
  const alreadyExists =
    error.message?.toLowerCase().includes('already exists') ||
    error.statusCode === '409' ||
    error.status === 409;

  if (alreadyExists) {
    return { created: false }; // bucket is fine — nothing to do
  }

  // Any other error is a real problem
  console.error(`[supabase-utils] Failed to create bucket "${bucketName}":`, error);
  throw new Error(`Gagal membuat bucket storage: ${error.message}`);
}

export const PHOTO_MIME_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export function classCodeFromStudentId(studentId) {
  const value = String(studentId || '').trim();
  if (!/^[A-Za-z0-9_-]+\/[A-Za-z0-9]{2,5}\/[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }

  const parts = value.split('/');
  const classCode = parts[1]?.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,5}$/.test(classCode)) {
    return null;
  }
  return classCode;
}

/**
 * Derives the Supabase bucket name from a student ID or class code.
 *
 * @param {string} classCode  e.g. "SAB"
 * @returns {string}  e.g. "pasfoto-sab"
 */
export function bucketNameForClass(classCode) {
  return `pasfoto-${classCode.toLowerCase()}`;
}

export function storageBaseNameForStudent(studentId) {
  const normalized = String(studentId || '').trim();
  if (!normalized || !classCodeFromStudentId(normalized)) return null;
  return normalized.replace(/\//g, '-');
}

export function photoUrlForStudent(studentId, version = '') {
  const params = new URLSearchParams({ studentId });
  if (version) params.set('v', version);
  return `/api/photo?${params.toString()}`;
}

export async function listAllFiles(supabase, bucketName, pageSize = 200) {
  const files = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data = [], error } = await supabase.storage
      .from(bucketName)
      .list('', { limit: pageSize, offset });

    if (error) return { data: null, error };
    files.push(...data);
    if (data.length < pageSize) return { data: files, error: null };
  }
}

export async function findStudentPhoto(supabase, bucketName, studentId) {
  const baseFilename = storageBaseNameForStudent(studentId);
  if (!baseFilename) return null;

  const { data: files, error } = await supabase.storage
    .from(bucketName)
    .list('', { search: baseFilename, limit: 20 });

  if (error || !files?.length) return null;

  return files.find((file) => {
    const parts = file.name.split('.');
    const ext = parts.pop()?.toLowerCase();
    return PHOTO_MIME_TYPES[ext] && parts.join('.') === baseFilename;
  }) || null;
}
