chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["picker.js"] });
  } catch (error) {
    console.warn("React Color Picker could not start on this page:", error);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "color-picker:get-palette" && message?.type !== "color-picker:set-palette") return;
  if (message.type === "color-picker:get-palette") {
    chrome.storage.local.get({ colorPickerPalette: [] }, ({ colorPickerPalette }) => sendResponse(colorPickerPalette));
  } else {
    chrome.storage.local.set({ colorPickerPalette: message.colors }, () => sendResponse({ ok: !chrome.runtime.lastError }));
  }
  return true;
});
