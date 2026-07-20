(function () {
  const VERSION = '1.1.1';
  const ICON_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const componentName = name => name.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('');

  class RemoteReicon extends HTMLElement {
    static observedAttributes = ['icon', 'weight'];

    connectedCallback() {
      this.render();
    }

    attributeChangedCallback() {
      if (this.isConnected) this.render();
    }

    async render() {
      const request = (this.renderRequest || 0) + 1;
      this.renderRequest = request;
      const name = this.getAttribute('icon') || '';
      if (!ICON_NAME.test(name)) return this.replaceChildren();

      try {
        const module = await import(`https://unpkg.com/reicon@${VERSION}/icons/${componentName(name)}.js`);
        if (request !== this.renderRequest) return;
        const svg = module.default({
          size: 24,
          weight: this.getAttribute('weight') === 'filled' ? 'Filled' : 'Outline',
        });
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('aria-hidden', 'true');
        this.replaceChildren(svg);
      } catch {
        if (request === this.renderRequest) this.replaceChildren();
      }
    }
  }

  if (!customElements.get('re-icon')) customElements.define('re-icon', RemoteReicon);
})();
