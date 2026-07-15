(function() {
  const MAX_VISIBLE_TOASTS = 4;
  const TOAST_DURATION_MS = 5000;

  window.showToast = function(message, type = 'success', options = {}) {
    const container = document.getElementById('toast-container');
    if (!container) return null;

    const { actionLabel, onAction, badge } = options;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const iconName = type === 'error' ? 'close-circle2' : type === 'info' ? 'info-circle' : type === 'duplicate' ? 'refresh' : 'check-circle';
    const icon = window.createAppIcon(iconName, 'toast-icon');
    const content = document.createElement('span');
    content.className = 'toast-content';
    if (badge) {
      const badgeElement = document.createElement('span');
      badgeElement.className = 'toast-badge';
      badgeElement.textContent = badge;
      content.appendChild(badgeElement);
      const separator = document.createElement('span');
      separator.className = 'toast-separator';
      separator.setAttribute('aria-hidden', 'true');
      separator.textContent = '•';
      content.appendChild(separator);
    }
    const text = document.createElement('span');
    text.className = 'toast-message';
    text.textContent = message;
    content.appendChild(text);
    toast.append(icon, content);

    let timer = null;

    const dismiss = () => {
      if (toast.classList.contains('hide')) return;
      if (timer) clearTimeout(timer);
      toast.classList.remove('show');
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 280);
    };

    if (actionLabel && typeof onAction === 'function') {
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'toast-action';
      action.textContent = actionLabel;
      action.addEventListener('click', event => {
        event.stopPropagation();
        try {
          onAction();
        } finally {
          dismiss();
        }
      });
      toast.appendChild(action);
    }

    const dismissButton = document.createElement('button');
    dismissButton.type = 'button';
    dismissButton.className = 'toast-dismiss';
    dismissButton.setAttribute('aria-label', 'Tutup notifikasi');
    dismissButton.innerHTML = '<span aria-hidden="true">&times;</span>';
    dismissButton.addEventListener('click', event => {
      event.stopPropagation();
      dismiss();
    });
    toast.appendChild(dismissButton);

    container.appendChild(toast);
    while (container.children.length > MAX_VISIBLE_TOASTS) {
      container.firstElementChild.remove();
    }
    requestAnimationFrame(() => toast.classList.add('show'));
    timer = setTimeout(dismiss, TOAST_DURATION_MS);

    return { dismiss };
  };
})();
