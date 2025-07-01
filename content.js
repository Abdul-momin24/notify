// Log to confirm the script is active
console.log("CONTENT SCRIPT LOADED");

// Listen for messages to get the selection on demand
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_SELECTION') {
    const selection = window.getSelection().toString().trim();
    console.log("GET_SELECTION request, found selection:", selection);
    if (selection) {
      const note = {
        text: selection,
        url: window.location.href,
        date: new Date().toLocaleString()
      };
      chrome.runtime.sendMessage({ type: 'NEW_NOTE', note });
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'No text selected.' });
    }
  }
});

// Keep track of the last saved note to avoid duplicates
let lastNote = { text: '', time: 0 };

// Check the current selection and send it as a note if it's new
function sendSelectionAsNote() {
  const selection = window.getSelection().toString().trim();
  console.log("Selection after mouseup:", selection);

  if (
    selection &&
    (selection !== lastNote.text || Date.now() - lastNote.time > 3000)
  ) {
    lastNote = { text: selection, time: Date.now() };
    const note = {
      text: selection,
      url: window.location.href,
      date: new Date().toLocaleString()
    };
    console.log("Sending NEW_NOTE:", note);
    chrome.runtime.sendMessage({ type: 'NEW_NOTE', note });
  }
}

// Listen for any selection finishing
document.addEventListener('mouseup', () => {
  // Use longer delay to ensure triple-click selection is ready
  setTimeout(sendSelectionAsNote, 300);
});
