const PLAYLIST_URL = 'https://www.youtube.com/playlist?list=WL#latertidy';
const YOUTUBE = 'https://www.youtube.com/*';

async function send(tabId: number, type: 'toggle' | 'open'): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(tabId, { type });
    return true;
  } catch {
    return false; // Tab predates the extension, so no content script is listening.
  }
}

async function run() {
  // The url field is only readable for tabs matching the host permission, which is the check.
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true, url: YOUTUBE });
  if (active?.id != null) {
    if (!(await send(active.id, 'toggle'))) await chrome.tabs.update(active.id, { url: PLAYLIST_URL });
    return;
  }
  const [existing] = await chrome.tabs.query({ url: YOUTUBE });
  if (existing?.id != null) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
    if (!(await send(existing.id, 'open'))) await chrome.tabs.update(existing.id, { url: PLAYLIST_URL });
    return;
  }
  await chrome.tabs.create({ url: PLAYLIST_URL });
}

chrome.action.onClicked.addListener(() => void run());
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-latertidy') void run();
});
