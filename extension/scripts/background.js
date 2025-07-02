chrome.runtime.onInstalled.addListener(() => {
  console.log('Service worker started, creating context menu...');
  chrome.contextMenus.create({
    id: 'save_note',
    title: 'Save selection as note',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'save_note' && info.selectionText) {
    const note = {
      text: info.selectionText,
      url: info.pageUrl || (tab ? tab.url : ''),
      timestamp: new Date().toISOString()
    };

    // Save the note to storage
    chrome.storage.local.get({ webNotes: [] }, (result) => {
      const notes = result.webNotes;
      notes.push(note);
      chrome.storage.local.set({ webNotes: notes }, () => {
        console.log('Note saved:', note);
      });
    });

    // Optionally notify the user via content script or badge
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'NOTE_SAVED', note });
    }
  }
});

// Listen for NEW_NOTE messages from content.js and save to chrome.storage.local
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'NEW_NOTE' && msg.note) {
    chrome.storage.local.get({ webNotes: [] }, (result) => {
      const notes = result.webNotes;
      notes.push(msg.note);
      chrome.storage.local.set({ webNotes: notes }, () => {
        console.log('Note saved via message:', msg.note);
      });
    });
  }
});

// Open note window when extension icon is clicked
chrome.action.onClicked.addListener(() => {
  const width = 400;
  const height = 500;
  // Get screen dimensions for positioning
  chrome.system.display.getInfo((displays) => {
    const display = displays[0];
    const left = display.workArea.width - width - 20;
    const top = display.workArea.height - height - 20;
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
});

// Listen for hotkey command to show the floating note widget
chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle_note_widget") {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {type: "SHOW_NOTE_WIDGET"});
    });
  }
});
