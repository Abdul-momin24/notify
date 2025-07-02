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
  widget.style.background = '#fff';
  widget.style.border = 'none';
  widget.style.borderRadius = '14px';
  widget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.18)';
  widget.style.zIndex = '999999';
  widget.style.padding = '0';
  widget.style.fontFamily = 'Segoe UI, Arial, sans-serif';
  widget.style.minWidth = '340px';
  widget.style.maxWidth = '95vw';
  widget.style.transition = 'box-shadow 0.2s';

  widget.innerHTML = `
    <div id="notify-drag-handle" style="display:flex;justify-content:space-between;align-items:center;cursor:move;background:#1976d2;color:#fff;padding:10px 16px 10px 16px;border-radius:14px 14px 0 0;user-select:none;">
      <span style="font-weight:600;letter-spacing:0.5px;">Quick Note</span>
      <button id="notify-close-widget" style="background:none;border:none;font-size:20px;cursor:pointer;color:#fff;">&times;</button>
    </div>
    <div style="padding:18px 18px 10px 18px;">
      <input id="notify-context" type="text" placeholder="Context..." style="width:100%;margin-bottom:10px;padding:8px 10px;border:1px solid #ccc;border-radius:6px;font-size:15px;" />
      <div style="display: flex; align-items: flex-start; gap: 8px; margin-bottom:10px;">
        <textarea id="notify-note-text" rows="4" style="width:100%;resize:vertical;padding:8px 10px;border:1px solid #ccc;border-radius:6px;font-size:15px;" placeholder="Write or paste your note here..."></textarea>
        <button id="notify-mic-btn" title="Start/Stop Speech to Text" style="height: 40px; width: 40px; border-radius: 50%; border: none; background: #e3eafc; cursor: pointer; font-size: 20px; display: flex; align-items: center; justify-content: center; margin-top:2px;">
          <span id="notify-mic-icon">🎤</span>
        </button>
      </div>
      <span id="notify-listening-indicator" style="color: #d32f2f; display: none; font-size: 13px;">Listening...</span>
      <div id="notify-interim-overlay" style="color: #888; font-size: 13px; min-height: 18px; margin-top: 2px;"></div>
      <button id="notify-save-widget" style="margin-top:10px;width:100%;background:#1976d2;color:white;border:none;padding:10px 0;border-radius:6px;cursor:pointer;font-size:16px;font-weight:500;">Save Note</button>
      <button id="notify-create-action-btn" style="margin-top:10px;width:100%;background:#388e3c;color:white;border:none;padding:10px 0;border-radius:6px;cursor:pointer;font-size:16px;font-weight:500;">Create Action Item</button>
      <span id="notify-action-loading" style="display:none; color: #1976d2; margin-left: 10px;">Generating...</span>
    </div>
    <div id="notify-toast" style="display:none;position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#323232;color:#fff;padding:10px 24px;border-radius:6px;font-size:15px;z-index:1000000;box-shadow:0 2px 8px rgba(0,0,0,0.18);">Action item created!</div>
  `;

  document.body.appendChild(widget);

  // Live update note textarea with selected text
  function updateNoteWithSelection() {
    const selection = window.getSelection().toString().trim();
    const textarea = document.getElementById('notify-note-text');
    if (textarea && selection) {
      textarea.value = selection;
    }
  }
  // Listen for selection changes while widget is open
  function addSelectionListeners() {
    document.addEventListener('mouseup', updateNoteWithSelection);
    document.addEventListener('keyup', updateNoteWithSelection);
  }
  function removeSelectionListeners() {
    document.removeEventListener('mouseup', updateNoteWithSelection);
    document.removeEventListener('keyup', updateNoteWithSelection);
  }
  addSelectionListeners();

  document.getElementById('notify-close-widget').onclick = () => {
    stopSpeechRecognition();
    widget.remove();
    removeSelectionListeners();
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
        showToast('Note saved!');
        widget.remove();
      });
    });
  };
  document.getElementById('notify-mic-btn').onclick = toggleSpeechRecognition;
  if (startListening) startSpeechRecognition();

  // Make widget movable by dragging the top bar
  let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;
  const dragHandle = widget.querySelector('#notify-drag-handle');
  dragHandle.addEventListener('mousedown', (e) => {
    isDragging = true;
    const rect = widget.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    widget.style.transition = 'none';
    document.body.style.userSelect = 'none';
  });
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      widget.style.left = (e.clientX - dragOffsetX) + 'px';
      widget.style.top = (e.clientY - dragOffsetY) + 'px';
      widget.style.right = 'auto';
      widget.style.bottom = 'auto';
      widget.style.position = 'fixed';
    }
  });
  document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.userSelect = '';
  });

  // Create Action Item logic
  async function callActionAPI(context, note, url) {
    const response = await fetch('http://localhost:3000/gemini-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, note, url })
    });
    if (!response.ok) throw new Error('Failed to fetch from Gemini API');
    const data = await response.json();
    return data.action || 'No action generated';
  }
  document.getElementById('notify-create-action-btn').onclick = async () => {
    const context = document.getElementById('notify-context').value.trim();
    const note = document.getElementById('notify-note-text').value.trim();
    const url = window.location.href;
    if (!context || !note) {
      alert('Please enter both context and note.');
      return;
    }
    const loading = document.getElementById('notify-action-loading');
    loading.style.display = '';
    try {
      const actionTask = await callActionAPI(context, note, url);
      chrome.storage.local.get({ actionItems: [] }, (result) => {
        const updated = [...result.actionItems, actionTask];
        chrome.storage.local.set({ actionItems: updated }, () => {
          loading.style.display = 'none';
          showToast('Action item created!');
        });
      });
    } catch (e) {
      alert('Failed to generate action item.');
      loading.style.display = 'none';
    }
  };

  // Toast feedback function
  function showToast(msg) {
    const toast = document.getElementById('notify-toast');
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 2000);
  }
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
