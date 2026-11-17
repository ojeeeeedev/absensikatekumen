/**
 * Owns profile-photo selection, client-side validation, modal state, and upload.
 * Student data and list refresh stay with profile.js through callbacks so this
 * controller does not depend on that page's data model.
 *
 * States: closed -> open (idle) -> picked -> uploading -> success | failed
 *   - While uploading, the user cannot close the sheet or pick another file.
 *   - A programmatic close (view switch, logout) lets the upload finish in the
 *     background; onUploaded always receives the student the upload was for.
 */
window.createProfilePhotoUploader = function createProfilePhotoUploader({ onUploaded, onAuthExpired }) {
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  // Vercel rejects request bodies above ~4.5MB before the handler runs, so
  // larger photos are downscaled in the browser first.
  const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
  const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
  const RESIZE_MAX_EDGE = 1600;
  const SHEET_MOTION_MS = 280;
  const SHEET_REDUCED_MOTION_MS = 120;
  const SUCCESS_CLOSE_DELAY_MS = 600;

  let isUploading = false;
  let successTimer = null;
  let selectionId = 0;
  let currentStudentId = null;
  let currentStudentName = null;
  let selectedFile = null;
  let closeTimer = null;
  let focusTimer = null;
  let openFrame = null;
  let returnFocus = null;

  // DOM refs (resolved lazily after DOMContentLoaded)
  let modal, dropzone, fileInput, previewImg, studentLabel,
      dropzoneIcon, dropzoneText, dropzoneSubtext,
      progressWrap, progressBar,
      confirmBtn, closeBtn;

  function init() {
    modal        = document.getElementById('upload-preview-modal');
    dropzone     = document.getElementById('upload-dropzone');
    fileInput    = document.getElementById('upload-file-input');
    previewImg   = document.getElementById('upload-preview-img');
    studentLabel = document.getElementById('upload-student-label');
    dropzoneIcon = document.getElementById('upload-dropzone-icon');
    dropzoneText = document.getElementById('upload-dropzone-text');
    dropzoneSubtext = document.getElementById('upload-dropzone-subtext');
    progressWrap = document.getElementById('upload-progress-wrap');
    progressBar  = document.getElementById('upload-progress-bar');
    confirmBtn   = document.getElementById('upload-confirm-btn');
    closeBtn     = document.getElementById('upload-close-btn');

    if (!modal) return; // not on profile page

    // Close actions
    // User-initiated close is ignored mid-upload so the result is not lost.
    const userClose = () => { if (!isUploading) close(); };
    closeBtn.addEventListener('click', userClose);
    modal.addEventListener('click', (e) => { if (e.target === modal) userClose(); });

    // Keyboard close
    document.addEventListener('keydown', (e) => {
      if (!modal.classList.contains('open')) return;
      if (e.key === 'Escape') userClose();
      if (e.key === 'Tab') trapFocus(e);
    });

    // Dropzone click → open native file picker
    dropzone.addEventListener('click', () => { if (!isUploading) fileInput.click(); });
    dropzone.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !isUploading) { e.preventDefault(); fileInput.click(); }
    });

    // File input change
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) handleFileSelect(fileInput.files[0]);
    });

    // Drag & drop
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFileSelect(file);
    });

    // Confirm upload
    confirmBtn.addEventListener('click', doUpload);
  }

  // aria-modal sheet: keep Tab and Shift+Tab inside it while it is open.
  function trapFocus(event) {
    const focusable = [...modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter(element => !element.disabled && element.getAttribute('aria-disabled') !== 'true'
        && element.type !== 'file' && element.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!modal.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function open(studentId, studentName, initialFile) {
    if (isUploading) {
      showToast('Tunggu unggahan foto sebelumnya selesai.', 'info');
      return;
    }
    clearTimeout(successTimer);
    successTimer = null;
    clearTimeout(closeTimer);
    clearTimeout(focusTimer);
    if (openFrame !== null) cancelAnimationFrame(openFrame);
    closeTimer = null;
    focusTimer = null;
    openFrame = null;
    if (!modal.classList.contains('open')) returnFocus = document.activeElement;

    currentStudentId = studentId;
    currentStudentName = studentName;
    selectedFile = null;

    // Reset UI
    resetDropzone();
    progressWrap.classList.remove('visible');
    progressBar.style.width = '0%';
    progressWrap.setAttribute('aria-valuenow', '0');
    confirmBtn.disabled = true;
    confirmBtn.classList.remove('uploading');
    closeBtn.disabled = false;
    fileInput.value = '';

    // Set student label
    studentLabel.textContent = `${studentName} · ${studentId}`;

    // Show modal
    modal.classList.remove('is-visible', 'is-closing');
    modal.classList.add('open');
    modal.inert = false;
    modal.removeAttribute('aria-hidden');
    document.body.style.overflow = 'hidden';
    modal.getBoundingClientRect();
    openFrame = requestAnimationFrame(() => {
      openFrame = null;
      if (modal.classList.contains('open')) modal.classList.add('is-visible');
    });
    if (initialFile) handleFileSelect(initialFile);

    // Focus close button for accessibility
    focusTimer = setTimeout(() => {
      focusTimer = null;
      if (modal.classList.contains('is-visible')) closeBtn.focus();
    }, 50);
  }

  function close(options = {}) {
    if (!modal?.classList.contains('open') || modal.classList.contains('is-closing')) return;
    const onClosed = typeof options.onClosed === 'function' ? options.onClosed : null;
    clearTimeout(focusTimer);
    focusTimer = null;
    if (openFrame !== null) cancelAnimationFrame(openFrame);
    openFrame = null;

    modal.classList.remove('is-visible');
    modal.classList.add('is-closing');
    // Return focus if it is inside the sheet, or was dropped to <body> because
    // the focused control became disabled during the upload.
    const focusLost = !document.activeElement || document.activeElement === document.body;
    if (modal.contains(document.activeElement) || focusLost) returnFocus?.focus?.({ preventScroll: true });
    modal.inert = true;
    modal.setAttribute('aria-hidden', 'true');

    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches
      ? SHEET_REDUCED_MOTION_MS
      : SHEET_MOTION_MS;
    closeTimer = setTimeout(() => {
      modal.classList.remove('open', 'is-closing');
      modal.inert = false;
      modal.removeAttribute('aria-hidden');
      document.body.style.overflow = '';
      selectedFile = null;
      selectionId += 1;
      currentStudentId = null;
      currentStudentName = null;
      fileInput.value = '';
      resetDropzone(); // Release the (possibly large) data-URL preview.
      closeTimer = null;
      returnFocus = null;
      onClosed?.();
    }, duration);
  }

  function resetDropzone() {
    previewImg.style.display = 'none';
    previewImg.src = '';
    dropzoneIcon.style.display = '';
    dropzoneText.style.display = '';
    dropzoneSubtext.style.display = '';
  }

  // Downscales a photo that is too large to upload; returns null if it cannot.
  async function shrinkImage(file) {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, RESIZE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close?.();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
      if (!blob || blob.size > MAX_UPLOAD_BYTES) return null;
      const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
      return new File([blob], name, { type: 'image/jpeg' });
    } catch (error) {
      console.error('[PhotoUploader] Resize failed:', error);
      return null;
    }
  }

  async function handleFileSelect(file) {
    if (isUploading) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      showToast('Format tidak didukung. Gunakan JPG, PNG, atau WebP.', 'error');
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      showToast('Ukuran file terlalu besar.', 'error');
      return;
    }

    // Later selections win over earlier ones that are still being prepared.
    const thisSelection = ++selectionId;
    confirmBtn.disabled = true;
    let uploadFile = file;
    if (file.size > MAX_UPLOAD_BYTES) {
      uploadFile = await shrinkImage(file);
      if (thisSelection !== selectionId) return;
      if (!uploadFile) {
        showToast('Foto terlalu besar dan tidak dapat diperkecil. Gunakan foto lain.', 'error');
        return;
      }
    }

    selectedFile = uploadFile;

    const reader = new FileReader();
    reader.onload = (e) => {
      if (thisSelection !== selectionId) return;
      previewImg.src = e.target.result;
      previewImg.style.display = 'block';
      dropzoneIcon.style.display = 'none';
      dropzoneText.style.display = 'none';
      dropzoneSubtext.style.display = 'none';
    };
    reader.readAsDataURL(uploadFile);

    confirmBtn.disabled = false;
  }

  function setProgress(percent) {
    progressBar.style.width = `${percent}%`;
    progressWrap.setAttribute('aria-valuenow', String(percent));
  }

  function resetUploadControls() {
    confirmBtn.classList.remove('uploading');
    confirmBtn.disabled = !selectedFile;
    closeBtn.disabled = false;
    dropzone.removeAttribute('aria-disabled');
    progressWrap.classList.remove('visible');
    setProgress(0);
  }

  async function doUpload() {
    if (isUploading || !selectedFile || !currentStudentId) return;

    // Captured now: the modal may be closed or reopened for another student
    // before the request finishes.
    const studentId = currentStudentId;
    const file = selectedFile;
    isUploading = true;

    confirmBtn.classList.add('uploading');
    confirmBtn.disabled = true;
    closeBtn.disabled = true;
    dropzone.setAttribute('aria-disabled', 'true');
    progressWrap.classList.add('visible');
    setProgress(30);

    const formData = new FormData();
    formData.append('studentId', studentId);
    formData.append('photo', file, file.name);

    let res;
    let data;
    try {
      setProgress(60);
      res = await fetch('/api/upload-photo', {
        method: 'POST',
        body: formData,
      });
      data = await res.json().catch(() => null);
    } catch (err) {
      console.error('[PhotoUploader] Upload network error:', err);
      isUploading = false;
      showToast('Tidak ada koneksi. Foto belum terunggah, coba lagi.', 'error');
      resetUploadControls();
      return;
    }
    isUploading = false;

    if (res.status === 401) {
      resetUploadControls();
      onAuthExpired?.();
      return;
    }

    if (!res.ok || data?.status !== 'ok') {
      const message = res.status === 413
        ? 'Ukuran foto terlalu besar.'
        : (res.status < 500 && data?.message) || 'Gagal mengunggah foto. Coba lagi.';
      showToast(message, 'error');
      resetUploadControls();
      return;
    }

    setProgress(100);
    showToast('Foto berhasil diunggah! ✓', 'success');
    // Always update the student this upload was for, even if the sheet was closed.
    onUploaded?.({ studentId, image: data.image });

    if (currentStudentId === studentId && modal.classList.contains('open')) {
      successTimer = setTimeout(() => {
        successTimer = null;
        if (currentStudentId === studentId) close();
      }, SUCCESS_CLOSE_DELAY_MS);
    }
  }

  return { init, open, close };
};
