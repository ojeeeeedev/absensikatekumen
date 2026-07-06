(function() {
  const createAppIcon = (name, className = '') => {
    const icon = document.createElement('re-icon');
    icon.setAttribute('icon', name);
    icon.setAttribute('decorative', '');
    if (className) icon.className = className;
    return icon;
  };

  window.createAppIcon = createAppIcon;
})();
