/**
 * Owns profile-photo selection, client-side validation, modal state, and upload.
 * Student lookup and list refresh stay with profile.js through callbacks so this
 * controller does not depend on that page's data model.
 */
window.createProfilePhotoUploader = function createProfilePhotoUploader({ getToken, findStudent, onUploaded }) {
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

  let currentStudentId = null;
  let currentStudentName = null;
  let selectedFile = null;

  // DOM refs (resolved lazily after DOMContentLoaded)
  let modal, dropzone, fileInput, previewImg, studentLabel,
      dropzoneIcon, dropzoneText, dropzoneSubtext,
      progressWrap, progressBar,
      confirmBtn, cancelBtn, closeBtn;

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
    cancelBtn    = document.getElementById('upload-cancel-btn');
    closeBtn     = document.getElementById('upload-close-btn');

    if (!modal) return; // not on profile page

    // Close actions
    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    // Keyboard close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) close();
    });

    // Dropzone click → open native file picker
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); fileInput.click(); }
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

  function open(studentId, studentName) {
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
    fileInput.value = '';

    // Set student label
    studentLabel.textContent = `${studentName} · ${studentId}`;

    // Show modal
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Focus close button for accessibility
    setTimeout(() => closeBtn.focus(), 50);
  }

  function close() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
    selectedFile = null;
    currentStudentId = null;
    currentStudentName = null;
    fileInput.value = '';
  }

  function resetDropzone() {
    previewImg.style.display = 'none';
    previewImg.src = '';
    dropzoneIcon.style.display = '';
    dropzoneText.style.display = '';
    dropzoneSubtext.style.display = '';
  }

  function handleFileSelect(file) {
    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      showToast('Format tidak didukung. Gunakan JPG, PNG, atau WebP.', 'error');
      return;
    }
    // Validate size
    if (file.size > MAX_SIZE_BYTES) {
      showToast('Ukuran file melebihi batas 5MB.', 'error');
      return;
    }

    selectedFile = file;

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewImg.style.display = 'block';
      dropzoneIcon.style.display = 'none';
      dropzoneText.style.display = 'none';
      dropzoneSubtext.style.display = 'none';
    };
    reader.readAsDataURL(file);

    confirmBtn.disabled = false;
  }

  async function doUpload() {
    if (!selectedFile || !currentStudentId) return;

    // Set uploading state
    confirmBtn.classList.add('uploading');
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    closeBtn.disabled = true;
    progressWrap.classList.add('visible');
    progressBar.style.width = '30%';
    progressWrap.setAttribute('aria-valuenow', '30');

    const formData = new FormData();
    formData.append('studentId', currentStudentId);
    formData.append('photo', selectedFile, selectedFile.name);

    try {
      progressBar.style.width = '60%';
      progressWrap.setAttribute('aria-valuenow', '60');

      const res = await fetch('/api/upload-photo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
        },
        body: formData,
      });

      progressBar.style.width = '90%';
      progressWrap.setAttribute('aria-valuenow', '90');
      const data = await res.json();

      if (data.status === 'ok') {
        progressBar.style.width = '100%';
        progressWrap.setAttribute('aria-valuenow', '100');

        // Update the in-memory student data immediately with the private app URL
        if (data.image) {
          const student = findStudent(currentStudentId);
          if (student) {
            student.image = data.image;
          }
        }

        showToast('Foto berhasil diunggah! ✓', 'success');

        // Close modal and re-render the current student list to show new photo
        setTimeout(() => {
          close();
          onUploaded();
        }, 600);
      } else {
        throw new Error(data.message || 'Gagal mengunggah foto');
      }
    } catch (err) {
      console.error('[PhotoUploader] Upload error:', err);
      showToast(`Gagal mengunggah: ${err.message}`, 'error');

      // Reset state
      confirmBtn.classList.remove('uploading');
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
      closeBtn.disabled = false;
      progressWrap.classList.remove('visible');
      progressBar.style.width = '0%';
      progressWrap.setAttribute('aria-valuenow', '0');
    }
  }

  return { init, open, close };
};
