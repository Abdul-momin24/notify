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
