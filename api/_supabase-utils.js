/**
 * Shared Supabase storage utilities.
 *
 * Extracted so multiple API handlers (upload-photo, init-bucket, etc.)
 * can reuse this logic without duplication.
 */

/**
 * Ensures a Supabase storage bucket exists, creating it if necessary.
 *
 * The bucket is created as private (public: false) so that all file access
 * must go through signed URLs — consistent with the rest of the app.
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
    public: false,            // signed-URL access only
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

/**
 * Derives the Supabase bucket name from a student ID or class code.
 *
 * @param {string} classCode  e.g. "SAB"
 * @returns {string}  e.g. "pasfoto-sab"
 */
export function bucketNameForClass(classCode) {
  return `pasfoto-${classCode.toLowerCase()}`;
}
