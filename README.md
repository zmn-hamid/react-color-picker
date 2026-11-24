# React Color Picker

A local-only Chrome extension for designers to select a page element, preview a chosen color property live, and copy the component context and chosen color. Palette colors are saved in `chrome.storage.local` and are available across sites. The extension makes no network requests.

## Install

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select this directory.
3. Open or reload the page to design, then click the extension icon.

## Use

Hover to highlight an element and click it. Choose which part to recolor—background, text, border, outline, text decoration, or SVG fill/stroke—then use the color wheel or enter a `#RRGGBB` hex value to preview the change live. Click **Add color** to save the current color in your persistent palette, then click a palette swatch to apply it. Right-click a swatch to remove it. Click **Accept & copy** to keep the preview and copy component source/name, a DOM selector, the chosen target, and its CSS color declaration to the clipboard. **Cancel**, the extension icon, or Escape restores the original inline styles and closes the picker.

The picker uses React metadata exposed on the page when available and otherwise reports it as unavailable. `data-design-source` is included as a component source hint when present. The generated selector may change as the page changes. Cross-origin frames and shadow-root internals are not inspected. Page scripts can observe or interfere with injected code, and earlier page event listeners may run before the picker.

The extension uses `activeTab`, `scripting`, and `storage`. It injects only after an explicit click on the extension icon. Chrome restricts injection on browser pages and the Web Store. Palette entries are stored locally in extension storage and are not sent anywhere.
