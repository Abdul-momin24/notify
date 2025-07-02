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

// Floating Note Widget Injection
function injectNoteWidget(startListening = false) {
  if (document.getElementById('notify-note-widget')) {
    if (startListening) startSpeechRecognition();
    return; // Prevent duplicates
  }

  const widget = document.createElement('div');
  widget.id = 'notify-note-widget';
  widget.style.position = 'fixed';
  widget.style.bottom = '30px';
  widget.style.right = '30px';
  widget.style.width = '350px';
  widget.style.background = 'white';
  widget.style.border = '2px solid #888';
  widget.style.borderRadius = '10px';
  widget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.2)';
  widget.style.zIndex = '999999';
  widget.style.padding = '16px';
  widget.style.fontFamily = 'Arial, sans-serif';

  widget.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <strong>Quick Note</strong>
      <button id="notify-close-widget" style="background:none;border:none;font-size:18px;cursor:pointer;">&times;</button>
    </div>
    <input id="notify-context" type="text" placeholder="Context..." style="width:100%;margin:8px 0 4px 0;padding:4px;" />
    <div style="display: flex; align-items: center; gap: 8px;">
      <textarea id="notify-note-text" rows="4" style="width:100%;resize:vertical;" placeholder="Write or paste your note here..."></textarea>
      <button id="notify-mic-btn" title="Start/Stop Speech to Text" style="height: 40px; width: 40px; border-radius: 50%; border: none; background: #eee; cursor: pointer; font-size: 20px; display: flex; align-items: center; justify-content: center;">
        <span id="notify-mic-icon">🎤</span>
      </button>
    </div>
    <span id="notify-listening-indicator" style="color: red; display: none; font-size: 13px;">Listening...</span>
    <button id="notify-save-widget" style="margin-top:8px;width:100%;background:#1976d2;color:white;border:none;padding:8px;border-radius:5px;cursor:pointer;">Save Note</button>
  `;

  document.body.appendChild(widget);

  document.getElementById('notify-close-widget').onclick = () => {
    stopSpeechRecognition();
    widget.remove();
  };
  document.getElementById('notify-save-widget').onclick = () => {
    const text = document.getElementById('notify-note-text').value.trim();
    const context = document.getElementById('notify-context').value.trim();
    if (!text || !context) {
      alert('Please enter both a note and its context.');
      return;
    }
    const note = {
      text,
      context,
      url: window.location.href,
      date: new Date().toLocaleString()
    };
    chrome.storage.local.get({ webNotes: [] }, (result) => {
      const updatedNotes = [note, ...result.webNotes];
      chrome.storage.local.set({ webNotes: updatedNotes }, () => {
        stopSpeechRecognition();
        widget.remove();
      });
    });
  };
  document.getElementById('notify-mic-btn').onclick = toggleSpeechRecognition;
  if (startListening) startSpeechRecognition();
}

// Speech-to-Text (Web Speech API) for widget
let recognition;
let isListening = false;

function toggleSpeechRecognition() {
  if (!('webkitSpeechRecognition' in window)) {
    alert('Speech recognition not supported in this browser.');
    return;
  }
  if (!recognition) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      const textarea = document.getElementById('notify-note-text');
      const overlay = document.getElementById('notify-interim-overlay');
      if (textarea) {
        if (final) {
          textarea.value += final; // Only append final, never replace
          if (overlay) overlay.textContent = '';
        } else if (overlay) {
          overlay.textContent = interim;
        }
      }
    };
    recognition.onerror = (e) => {
      stopSpeechRecognition();
    };
    recognition.onend = () => {
      stopSpeechRecognition();
    };
  }
  if (!isListening) {
    startSpeechRecognition();
  } else {
    stopSpeechRecognition();
  }
}

function startSpeechRecognition() {
  if (!recognition) return;
  recognition.start();
  isListening = true;
  const indicator = document.getElementById('notify-listening-indicator');
  if (indicator) indicator.style.display = 'inline';
  const icon = document.getElementById('notify-mic-icon');
  if (icon) icon.textContent = '🛑';
}

function stopSpeechRecognition() {
  if (recognition && isListening) {
    recognition.stop();
    isListening = false;
    const indicator = document.getElementById('notify-listening-indicator');
    if (indicator) indicator.style.display = 'none';
    const icon = document.getElementById('notify-mic-icon');
    if (icon) icon.textContent = '🎤';
  }
}

// Listen for message to show the widget
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SHOW_NOTE_WIDGET') {
    injectNoteWidget();
  }
});

// Hotkey: Ctrl+Shift+M to open widget and start speech-to-text
window.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.shiftKey && e.code === 'KeyM') {
    e.preventDefault();
    injectNoteWidget(true);
  }
});
