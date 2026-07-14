(function() {
  class AppSpinner extends HTMLElement {
    connectedCallback() {
      if (this.shadowRoot) return;
      this.attachShadow({ mode: 'open' }).innerHTML = `
        <style>:host{display:block}svg{display:block;width:100%;height:100%;stroke:currentColor}</style>
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g><circle cx="12" cy="12" r="9.5" fill="none" stroke-width="3" stroke-linecap="round"><animate attributeName="stroke-dasharray" dur="1.5s" calcMode="spline" values="0 150;42 150;42 150;42 150" keyTimes="0;0.475;0.95;1" keySplines="0.42,0,0.58,1;0.42,0,0.58,1;0.42,0,0.58,1" repeatCount="indefinite"/><animate attributeName="stroke-dashoffset" dur="1.5s" calcMode="spline" values="0;-16;-59;-59" keyTimes="0;0.475;0.95;1" keySplines="0.42,0,0.58,1;0.42,0,0.58,1;0.42,0,0.58,1" repeatCount="indefinite"/></circle><animateTransform attributeName="transform" type="rotate" dur="2s" values="0 12 12;360 12 12" repeatCount="indefinite"/></g></svg>`;
    }
  }

  if (!customElements.get('app-spinner')) customElements.define('app-spinner', AppSpinner);

  const createAppIcon = (name, className = '') => {
    const icon = document.createElement('re-icon');
    icon.setAttribute('icon', name);
    icon.setAttribute('decorative', '');
    if (className) icon.className = className;
    return icon;
  };

  window.createAppIcon = createAppIcon;
})();
