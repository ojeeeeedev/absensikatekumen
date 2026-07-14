(function() {
  const MAX_VISIBLE_TOASTS = 4;

  window.showToast = function(message, type = 'success', options = {}) {
    const container = document.getElementById('toast-container');
    if (!container) return null;

    const { actionLabel, onAction, duration = 4000 } = options;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const iconName = type === 'error' ? 'close-circle2' : type === 'info' ? 'info-circle' : 'check-circle';
    const icon = window.createAppIcon(iconName, 'toast-icon');
    const text = document.createElement('span');
    text.className = 'toast-message';
    text.textContent = message;
    toast.append(icon, text);

    let timer = null;
    let startedAt = 0;
    let remaining = duration;

    const dismiss = () => {
      if (toast.classList.contains('hide')) return;
      if (timer) clearTimeout(timer);
      toast.classList.remove('show');
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 280);
    };

    const resume = () => {
      if (timer || toast.matches(':hover') || toast.contains(document.activeElement)) return;
      if (!Number.isFinite(remaining) || remaining <= 0) return;
      startedAt = Date.now();
      timer = setTimeout(dismiss, remaining);
    };

    const pause = () => {
      if (!timer) return;
      clearTimeout(timer);
      timer = null;
      remaining -= Date.now() - startedAt;
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

    toast.addEventListener('mouseenter', pause);
    toast.addEventListener('mouseleave', resume);
    toast.addEventListener('focusin', pause);
    toast.addEventListener('focusout', event => {
      if (!toast.contains(event.relatedTarget)) resume();
    });

    container.prepend(toast);
    while (container.children.length > MAX_VISIBLE_TOASTS) {
      container.lastElementChild.remove();
    }
    requestAnimationFrame(() => toast.classList.add('show'));
    resume();

    return { dismiss };
  };
})();
