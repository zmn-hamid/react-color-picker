(() => {
  'use strict';
  const KEY = '__reactColorPicker__';
  const validHex = value => /^#[\da-f]{6}$/i.test(value);

  function selectorFor(el) {
    const parts = [];
    for (let node = el; node?.nodeType === 1; node = node.parentElement) {
      let part = node.localName;
      if (node.id) { parts.unshift('#' + CSS.escape(node.id)); break; }
      const siblings = node.parentElement ? Array.from(node.parentElement.children).filter(x => x.localName === node.localName) : [];
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      parts.unshift(part);
    }
    return parts.join(' > ');
  }

  function reactNames(el) {
    let fiber;
    for (let node = el; node && !fiber; node = node.parentElement) {
      const key = Object.keys(node).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
      if (key) fiber = node[key];
    }
    const names = [], seen = new Set();
    for (let count = 0; fiber && count < 100 && !seen.has(fiber); count++, fiber = fiber.return) {
      seen.add(fiber);
      const type = fiber.elementType || fiber.type;
      const name = typeof type === 'function' ? (type.displayName || type.name) :
        (type && typeof type === 'object' ? (type.displayName || type.render?.displayName || type.render?.name) : '');
      if (name && !names.includes(name)) names.push(name);
    }
    return names;
  }

  function storage(type, colors) {
    return new Promise(resolve => {
      try {
        if (!globalThis.chrome?.runtime?.sendMessage) return resolve([]);
        chrome.runtime.sendMessage({ type, ...(colors ? { colors } : {}) }, result => resolve(type.endsWith('get-palette') ? (Array.isArray(result) ? result : []) : !!result?.ok));
      } catch (_) { resolve([]); }
    });
  }

  async function copyText(text, doc, clipboard) {
    try {
      if (!clipboard?.writeText) throw new Error('Clipboard unavailable');
      await clipboard.writeText(text); return true;
    } catch (_) {
      const field = doc.createElement('textarea');
      field.value = text; field.setAttribute('readonly', ''); field.style.cssText = 'position:fixed;left:-10000px;top:0';
      doc.body.appendChild(field); field.select();
      let copied = false;
      try { copied = doc.execCommand('copy'); } catch (_) { /* manual copy remains available */ }
      field.remove(); return copied;
    }
  }

  function start(doc, win) {
    if (win[KEY]) { win[KEY](); return; }
    const host = doc.createElement('div');
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none';
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = doc.createElement('style');
    style.textContent = `:host{all:initial}*{box-sizing:border-box}.outline{position:fixed;border:2px solid #2563eb;background:#2563eb20;pointer-events:none}.panel{pointer-events:auto;position:fixed;right:16px;bottom:16px;width:min(380px,calc(100vw - 32px));max-height:80vh;overflow:auto;background:#fff;color:#172033;border:1px solid #cbd5e1;border-radius:12px;box-shadow:0 8px 32px #0004;padding:16px;font:14px/1.4 system-ui,sans-serif}.panel h2{font-size:17px;margin:0 0 6px}.panel p{margin:4px 0 12px;color:#475569}.controls{display:flex;align-items:center;gap:9px;margin:14px 0}.controls input[type=color]{width:48px;height:42px;padding:2px;border:1px solid #cbd5e1;border-radius:6px;cursor:pointer}.hex{width:105px;padding:9px;border:1px solid #cbd5e1;border-radius:6px;font:14px monospace}.row{display:flex;gap:8px}.button{padding:8px 12px;border:0;border-radius:6px;background:#e2e8f0;color:#172033;font:inherit;cursor:pointer}.primary{background:#2563eb;color:white}.palette{display:flex;flex-wrap:wrap;gap:7px;margin:9px 0 14px}.swatch{width:28px;height:28px;border:2px solid white;outline:1px solid #94a3b8;border-radius:50%;cursor:pointer}.swatch[aria-pressed=true]{outline:2px solid #2563eb}.empty{font-size:12px;color:#64748b}.message{font-size:12px;min-height:17px;color:#475569}.manual{width:100%;height:110px;margin-top:8px;font:12px monospace}`;
    const outline = doc.createElement('div'); outline.className = 'outline'; outline.hidden = true;
    const panel = doc.createElement('section'); panel.className = 'panel'; panel.setAttribute('aria-label', 'React Color Picker');
    const heading = doc.createElement('h2'); heading.textContent = 'Pick an element';
    const help = doc.createElement('p'); help.textContent = 'Hover to highlight, then click an element to preview its background color. Escape cancels.';
    const controls = doc.createElement('div'); controls.className = 'controls';
    const wheel = doc.createElement('input'); wheel.type = 'color'; wheel.value = '#ffffff'; wheel.setAttribute('aria-label', 'Choose color');
    const hex = doc.createElement('input'); hex.className = 'hex'; hex.value = '#ffffff'; hex.maxLength = 7; hex.setAttribute('aria-label', 'Hex color');
    controls.append(wheel, hex);
    const paletteTitle = doc.createElement('strong'); paletteTitle.textContent = 'Palette';
    const palette = doc.createElement('div'); palette.className = 'palette';
    const buttons = doc.createElement('div'); buttons.className = 'row';
    const add = doc.createElement('button'); add.className = 'button'; add.textContent = 'Add color';
    const accept = doc.createElement('button'); accept.className = 'button primary'; accept.textContent = 'Accept & copy';
    const cancel = doc.createElement('button'); cancel.className = 'button'; cancel.textContent = 'Cancel';
    buttons.append(add, accept, cancel);
    const message = doc.createElement('div'); message.className = 'message';
    panel.append(heading, help, controls, paletteTitle, palette, buttons, message);
    shadow.append(style, outline, panel); doc.documentElement.appendChild(host);

    let selecting = true, closed = false, timer, selected = null, originalBackground = '', colors = [];
    const eventTypes = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
    const inside = event => event.composedPath().includes(host);
    function drawPalette() {
      palette.replaceChildren();
      if (!colors.length) { const empty = doc.createElement('span'); empty.className = 'empty'; empty.textContent = 'Add colors you use often.'; palette.append(empty); return; }
      colors.forEach((color, index) => {
        const swatch = doc.createElement('button'); swatch.className = 'swatch'; swatch.type = 'button'; swatch.style.backgroundColor = color;
        swatch.title = color; swatch.setAttribute('aria-label', `Use ${color}`); swatch.setAttribute('aria-pressed', String(hex.value.toLowerCase() === color));
        swatch.addEventListener('click', () => setColor(color));
        swatch.addEventListener('contextmenu', event => { event.preventDefault(); colors.splice(index, 1); storage('color-picker:set-palette', colors); drawPalette(); });
        palette.append(swatch);
      });
      const tip = doc.createElement('span'); tip.className = 'empty'; tip.textContent = 'Right-click a swatch to remove it.'; palette.append(tip);
    }
    function setColor(color) {
      if (!validHex(color)) return;
      color = color.toLowerCase(); wheel.value = color; hex.value = color;
      if (selected) selected.style.backgroundColor = color;
      drawPalette();
    }
    function move(event) {
      if (!selecting || inside(event) || !event.target.getBoundingClientRect) { outline.hidden = true; return; }
      const r = event.target.getBoundingClientRect(); outline.hidden = false;
      Object.assign(outline.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    }
    function intercept(event) {
      if (!selecting || inside(event)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.type === 'click') {
        selected = event.target;
        originalBackground = selected.style.getPropertyValue('background-color');
        const computed = win.getComputedStyle(selected).backgroundColor;
        const rgb = computed.match(/\d+/g);
        const initial = rgb?.length >= 3 ? '#' + rgb.slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('') : '#ffffff';
        selecting = false; outline.hidden = true; heading.textContent = 'Preview element color';
        help.textContent = `${selected.localName}${selected.id ? `#${selected.id}` : ''} — changes are live until you accept or cancel.`;
        setColor(initial);
      }
    }
    function cleanup(restore = true) {
      if (closed) return; closed = true;
      if (timer) win.clearTimeout(timer);
      if (restore && selected) selected.style.backgroundColor = originalBackground;
      doc.removeEventListener('pointermove', move, true);
      for (const type of eventTypes) doc.removeEventListener(type, intercept, true);
      doc.removeEventListener('keydown', keydown, true); host.remove(); delete win[KEY];
    }
    function keydown(event) { if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); cleanup(true); } }
    wheel.addEventListener('input', () => setColor(wheel.value));
    hex.addEventListener('input', () => { if (validHex(hex.value)) setColor(hex.value); });
    add.addEventListener('click', async () => {
      if (!validHex(hex.value)) { message.textContent = 'Enter a valid hex color first.'; return; }
      const color = hex.value.toLowerCase();
      if (!colors.includes(color)) { colors.push(color); await storage('color-picker:set-palette', colors); }
      message.textContent = 'Color saved to your palette.'; drawPalette();
    });
    cancel.addEventListener('click', () => cleanup(true));
    accept.addEventListener('click', async () => {
      if (!selected) { message.textContent = 'Select an element first.'; return; }
      const color = hex.value.toLowerCase();
      const names = reactNames(selected);
      const source = selected.getAttribute('data-design-source');
      const text = [
        source ? `Component source: ${source}` : `React component (nearest first): ${names.join(' → ') || '(unavailable)'}`,
        `Element: ${selected.localName}`,
        `DOM selector: ${selectorFor(selected)}`,
        `Background color: ${color}`,
        `CSS: background-color: ${color};`
      ].join('\n');
      accept.disabled = true; message.textContent = 'Copying component context and color…';
      const copied = await copyText(text, doc, win.navigator.clipboard);
      if (closed) return;
      if (copied) { message.textContent = 'Copied. Preview applied.'; cleanup(false); }
      else {
        message.textContent = 'Clipboard unavailable. Copy the text below manually.';
        const field = doc.createElement('textarea'); field.className = 'manual'; field.value = text; field.setAttribute('aria-label', 'Component and color'); field.setAttribute('readonly', '');
        panel.append(field); field.focus(); field.select(); accept.disabled = false;
      }
    });
    doc.addEventListener('pointermove', move, true);
    for (const type of eventTypes) doc.addEventListener(type, intercept, true);
    doc.addEventListener('keydown', keydown, true);
    win[KEY] = () => cleanup(true);
    storage('color-picker:get-palette').then(saved => { if (!closed) { colors = saved.filter(validHex); drawPalette(); } });
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { start, selectorFor, validHex, copyText };
  else start(document, window);
})();
