(function() {
  const COMBOBOX_MOTION_MS = 180;
  const COMBOBOX_REDUCED_MOTION_MS = 120;
  let closeActiveCombobox = null;

  window.createSearchCombobox = function({
    rootId,
    triggerId,
    popoverId,
    searchId,
    listId,
    emptyId,
    valueId,
    selectId,
    placeholder,
    getValue,
    getLabel,
    getSearchText = getLabel,
    getOptionClass = () => ''
  }) {
    const root = document.getElementById(rootId);
    const trigger = document.getElementById(triggerId);
    const popover = document.getElementById(popoverId);
    const search = document.getElementById(searchId);
    const list = document.getElementById(listId);
    const empty = document.getElementById(emptyId);
    const value = document.getElementById(valueId);
    const select = document.getElementById(selectId);
    if (!root || !trigger || !popover || !search || !list || !empty || !value || !select) return null;

    let items = [];
    let closeTimer = null;
    let openFrame = null;

    popover.dataset.state = 'closed';
    popover.inert = true;

    function motionDuration() {
      return matchMedia('(prefers-reduced-motion: reduce)').matches
        ? COMBOBOX_REDUCED_MOTION_MS
        : COMBOBOX_MOTION_MS;
    }

    function clearMotionTimers() {
      clearTimeout(closeTimer);
      closeTimer = null;
      if (openFrame !== null) cancelAnimationFrame(openFrame);
      openFrame = null;
    }

    function close(restoreFocus = false) {
      if (popover.hidden || trigger.getAttribute('aria-expanded') !== 'true') return;
      clearMotionTimers();
      popover.dataset.state = 'closed';
      popover.inert = true;
      trigger.setAttribute('aria-expanded', 'false');
      if (closeActiveCombobox === close) closeActiveCombobox = null;
      if (restoreFocus) trigger.focus();
      closeTimer = setTimeout(() => {
        if (popover.dataset.state === 'closed') popover.hidden = true;
        closeTimer = null;
      }, motionDuration());
    }

    function setValue(nextValue) {
      const item = items.find(candidate => getValue(candidate) === nextValue);
      select.value = item ? nextValue : '';
      value.textContent = item ? getLabel(item) : placeholder;
      trigger.classList.toggle('has-selection', Boolean(item));
      render(search.value);
    }

    function choose(item) {
      setValue(getValue(item));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      close(true);
    }

    function focusSibling(option, offset) {
      const options = [...list.querySelectorAll('[role="option"]')];
      const index = options.indexOf(option);
      options[(index + offset + options.length) % options.length]?.focus();
    }

    function render(query = '') {
      const term = query.trim().toLocaleLowerCase('id');
      const filtered = items.filter(item => !term || getSearchText(item).toLocaleLowerCase('id').includes(term));
      list.replaceChildren(...filtered.map(item => {
        const option = document.createElement('button');
        const selected = getValue(item) === select.value;
        option.type = 'button';
        option.className = `search-combobox-option ${getOptionClass(item)}`.trim();
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', String(selected));
        option.innerHTML = '<span></span><span class="search-combobox-check" aria-hidden="true">✓</span>';
        option.firstElementChild.textContent = getLabel(item);
        option.addEventListener('click', () => choose(item));
        option.addEventListener('keydown', event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            focusSibling(option, event.key === 'ArrowDown' ? 1 : -1);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            close(true);
          }
        });
        return option;
      }));
      empty.hidden = filtered.length > 0;
    }

    function open() {
      if (trigger.disabled) return;
      closeActiveCombobox?.();
      clearMotionTimers();
      popover.hidden = false;
      popover.inert = false;
      popover.dataset.state = 'closed';
      popover.getBoundingClientRect();
      trigger.setAttribute('aria-expanded', 'true');
      search.value = '';
      render();
      closeActiveCombobox = close;
      openFrame = requestAnimationFrame(() => {
        openFrame = null;
        if (popover.hidden) return;
        popover.dataset.state = 'open';
        if (!popover.contains(document.activeElement)) search.focus();
      });
    }

    function setItems(nextItems, unavailableLabel) {
      items = Array.isArray(nextItems) ? nextItems : [];
      select.replaceChildren(new Option(placeholder, '', true, true));
      select.firstElementChild.disabled = true;
      items.forEach(item => select.add(new Option(getLabel(item), getValue(item))));
      value.textContent = items.length ? placeholder : unavailableLabel;
      trigger.disabled = items.length === 0;
      render();
    }

    trigger.addEventListener('click', () => {
      if (trigger.getAttribute('aria-expanded') === 'true') close();
      else open();
    });
    trigger.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        open();
      }
    });
    search.addEventListener('input', () => render(search.value));
    search.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        list.querySelector('[role="option"]')?.focus();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
      }
    });
    document.addEventListener('pointerdown', event => {
      if (!root.contains(event.target)) close();
    });

    return { close, open, setItems, setValue };
  };
})();
