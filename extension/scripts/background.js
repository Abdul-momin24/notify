// On install: create context menu
const API_KEY = 'AIzaSyDCV74Ius71fdKhB6_YiXeUGCII8ak_3Wg';

chrome.runtime.onInstalled.addListener(() => {
  console.log('Service worker started, creating context menu...');
  chrome.contextMenus.create({
    id: 'save_note',
    title: 'Save selection as note',
    contexts: ['selection']
  });
});

// Handle context menu click to save selected text as note
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'save_note' && info.selectionText) {
    const note = {
      text: info.selectionText,
      url: info.pageUrl || (tab ? tab.url : ''),
      date: new Date().toLocaleString()
    };

    chrome.storage.local.get({ webNotes: [] }, (result) => {
      const updatedNotes = [...result.webNotes, note];
      chrome.storage.local.set({ webNotes: updatedNotes }, () => {
        console.log('Note saved:', note);
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, { type: 'NOTE_SAVED', note });
        }
      });
    });
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Save note sent from content.js
  if (msg.type === 'NEW_NOTE' && msg.note) {
    chrome.storage.local.get({ webNotes: [] }, (result) => {
      const updatedNotes = [...result.webNotes, msg.note];
      chrome.storage.local.set({ webNotes: updatedNotes }, () => {
        console.log('Note saved via message:', msg.note);
      });
    });
    return;
  }

  // Generate action item via Gemini API
  if (msg.type === 'GENERATE_ACTION_ITEM') {
    const { context, note, url } = msg.payload;

    const prompt = `Context: ${context}
Note: ${note}
URL: ${url}

Generate a single, concise, one-line action item (max 1 sentence) for the user, in this format:
Action: <one-liner action item>`;

    fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { parts: [{ text: prompt }] }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 60
        }
      })
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.error) {
          console.error("Gemini API Error:", data.error);
          sendResponse({ success: false, error: data.error.message });
          return;
        }
        const candidates = data.candidates;
        if (!candidates || candidates.length === 0) {
          sendResponse({ success: false, error: 'No candidates returned.' });
          return;
        }
        const text = candidates[0].content.parts[0].text;
        const actionMatch = text.match(/Action:\s*(.+)/i);
        const actionItem = actionMatch ? actionMatch[1].trim() : text.trim();
        sendResponse({ success: true, actionItem });
      })
      .catch((error) => {
        console.error('Gemini API Fetch Error:', error);
        sendResponse({ success: false, error: error.toString() });
      });

    return true; // Keep sendResponse alive for async
  }
});

// Open notes window when extension icon is clicked
chrome.action.onClicked.addListener(() => {
  const width = 400;
  const height = 500;

  // Fallback coordinates if display info fails
  const fallbackLeft = 100;
  const fallbackTop = 100;

  if (chrome.system?.display) {
    chrome.system.display.getInfo((displays) => {
      const display = displays?.[0];
      const left = display ? display.workArea.width - width - 20 : fallbackLeft;
      const top = display ? display.workArea.height - height - 20 : fallbackTop;

      chrome.windows.create({
        url: chrome.runtime.getURL('../pages/home.html'),
        type: 'popup',
        width,
        height,
        left,
        top,
        focused: true
      });
    });
  } else {
    // If system.display permission is missing, fallback
    chrome.windows.create({
      url: chrome.runtime.getURL('../pages/home.html'),
      type: 'popup',
      width,
      height,
      left: fallbackLeft,
      top: fallbackTop,
      focused: true
    });
  }
});

// Handle keyboard shortcut to toggle note widget
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle_note_widget') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs?.length && tabs[0].id) {
        // Fixed: message type should match content script listener
        chrome.tabs.sendMessage(tabs[0].id, { type: 'SHOW_NOTE_WIDGET' });
      } else {
        console.warn('No active tab found to inject widget.');
      }
    });
  }
});
