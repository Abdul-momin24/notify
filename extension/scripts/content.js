// Log to confirm the script is active
console.log("Content script loaded and active.");

// Listen for selection message
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

  if (msg.type === 'SHOW_NOTE_WIDGET') {
    injectNoteWidget();
  }
});

// Hotkey: Ctrl+Shift+M to open widget with speech
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.code === 'KeyM') {
    e.preventDefault();
    injectNoteWidget(true);
  }
});

// Track last note to avoid duplicates
let lastNote = { text: '', time: 0 };

let mouseDownY = null;

document.addEventListener('mousedown', (e) => {
  mouseDownY = e.clientY;
});

document.addEventListener('mouseup', (e) => {
  if (mouseDownY !== null && e.clientY < mouseDownY) {
    const selection = window.getSelection().toString().trim();
    const widget = document.getElementById('notify-note-widget');
    const noteTextarea = document.getElementById('notify-note-text');
    if (widget && noteTextarea && selection) {
      // Append the selected text to the note textarea
      if (noteTextarea.value && !noteTextarea.value.endsWith('\n')) {
        noteTextarea.value += '\n';
      }
      noteTextarea.value += selection;
      noteTextarea.focus();
    } else {
      setTimeout(sendSelectionAsNote, 300);
    }
  }
  mouseDownY = null;
});

function sendSelectionAsNote() {
  const selection = window.getSelection().toString().trim();
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
    chrome.runtime.sendMessage({ type: 'NEW_NOTE', note });
  }
}

// ==========================
// Note Widget
// ==========================
function injectNoteWidget(startListening = false) {
  if (document.getElementById('notify-note-widget')) {
    if (startListening) startSpeechRecognition();
    return;
  }

  const widget = document.createElement('div');
  widget.id = 'notify-note-widget';
  widget.style = `
    position: fixed; bottom: 30px; right: 30px; width: 350px; background: #fff;
    border-radius: 14px; box-shadow: 0 4px 24px rgba(0,0,0,0.18); z-index: 999999;
    font-family: Segoe UI, Arial, sans-serif; max-width: 95vw;
  `;

  widget.innerHTML = `
    <div id="notify-drag-handle" style="display:flex;justify-content:space-between;align-items:center;cursor:move;background:#1976d2;color:#fff;padding:10px 16px;border-radius:14px 14px 0 0;">
      <span style="font-weight:600;">Quick Note</span>
      <button id="notify-close-widget" style="background:none;border:none;font-size:20px;color:#fff;cursor:pointer;">&times;</button>
    </div>
    <div style="padding:16px;">
      <input id="notify-context" type="text" placeholder="Context..." style="width:100%;margin-bottom:8px;padding:8px;border:1px solid #ccc;border-radius:6px;" />
      <textarea id="notify-note-text" rows="4" placeholder="Write or paste your note here..." style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;margin-bottom:8px;"></textarea>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <button id="notify-mic-btn" title="Speech to Text" style="width:40px;height:40px;border-radius:50%;border:none;background:#e3eafc;cursor:pointer;">🎤</button>
        <span id="notify-listening-indicator" style="display:none;color:#d32f2f;font-size:13px;">Listening...</span>
      </div>
      <div id="notify-interim-overlay" style="color:#888;font-size:13px;min-height:16px;margin-bottom:8px;"></div>
      <button id="notify-save-widget" style="width:100%;background:#1976d2;color:#fff;border:none;padding:10px;border-radius:6px;margin-bottom:6px;cursor:pointer;">Save Note</button>
      <button id="notify-create-action-btn" style="width:100%;background:#388e3c;color:#fff;border:none;padding:10px;border-radius:6px;cursor:pointer;">Create Action Item</button>
      <span id="notify-action-loading" style="display:none;color:#1976d2;">Generating...</span>
    </div>
    <div id="notify-toast" style="display:none;position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#323232;color:#fff;padding:8px 16px;border-radius:6px;font-size:14px;z-index:1000000;">Action item created!</div>
  `;

  document.body.appendChild(widget);

  document.getElementById('notify-close-widget').onclick = () => {
    stopSpeechRecognition();
    widget.remove();
  };

  document.getElementById('notify-mic-btn').onclick = toggleSpeechRecognition;

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

  try {
    if (!chrome?.storage?.local) {
      console.warn("chrome.storage.local is unavailable (context invalidated).");
      return;
    }

    chrome.storage.local.get({ webNotes: [] }, (result) => {
      if (chrome.runtime.lastError) {
        console.error("Storage get error:", chrome.runtime.lastError);
        return;
      }

      const updatedNotes = [note, ...result.webNotes];
      chrome.storage.local.set({ webNotes: updatedNotes }, () => {
        if (chrome.runtime.lastError) {
          console.error("Storage set error:", chrome.runtime.lastError);
          return;
        }

        stopSpeechRecognition();
        showToast('Note saved!');
        const widget = document.getElementById('notify-note-widget');
        if (widget) widget.remove();
      });
    });
  } catch (e) {
    console.error("Unexpected error:", e);
  }
};

  // Make widget draggable
  let isDragging = false, offsetX = 0, offsetY = 0;
  const dragHandle = widget.querySelector('#notify-drag-handle');
  dragHandle.addEventListener('mousedown', (e) => {
    isDragging = true;
    const rect = widget.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    document.body.style.userSelect = 'none';
  });
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      widget.style.left = (e.clientX - offsetX) + 'px';
      widget.style.top = (e.clientY - offsetY) + 'px';
      widget.style.right = 'auto';
      widget.style.bottom = 'auto';
    }
  });
  document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.userSelect = '';
  });

  document.getElementById('notify-create-action-btn').onclick = async () => {
    const context = document.getElementById('notify-context').value.trim();
    const note = document.getElementById('notify-note-text').value.trim();
    const url = window.location.href;
    const pageData = getVisiblePageText();
    const loading = document.getElementById('notify-action-loading');
    if (!context || !note) {
      alert('Please enter both a note and its context.');
      return;
    }
    loading.style.display = '';
    showToast('Generating action item...');
    try {
      const actionTask = await callGeminiAPI(context, note, url, pageData);
      chrome.storage.local.get({ actionItems: [] }, (result) => {
        const updated = [...result.actionItems, actionTask];
        chrome.storage.local.set({ actionItems: updated }, () => {
          loading.style.display = 'none';
          showToast('Action item created!');
        });
      });
    } catch (e) {
      alert(`Failed to generate action item: ${e.message}`);
      loading.style.display = 'none';
    }
  };

  function showToast(msg) {
    const toast = document.getElementById('notify-toast');
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 2000);
  }

  // ==========================
  // Speech-to-text
  // ==========================
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
        let interim = '', final = '';
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
            textarea.value += final;
            if (overlay) overlay.textContent = '';
          } else if (overlay) {
            overlay.textContent = interim;
          }
        }
      };
      recognition.onerror = stopSpeechRecognition;
      recognition.onend = stopSpeechRecognition;
    }

    if (!isListening) {
      recognition.start();
      isListening = true;
      document.getElementById('notify-listening-indicator').style.display = 'inline';
      document.getElementById('notify-mic-btn').textContent = '🛑';
    } else {
      stopSpeechRecognition();
    }
  }

  function stopSpeechRecognition() {
    if (recognition && isListening) {
      recognition.stop();
      isListening = false;
      document.getElementById('notify-listening-indicator').style.display = 'none';
      document.getElementById('notify-mic-btn').textContent = '🎤';
    }
  }

  function getVisiblePageText() {
    return document.body.innerText.slice(0, 2000);
  }

  async function callGeminiAPI(context, note, url, pageData) {
    const prompt = `Context: ${context}\nNote: ${note}\nURL: ${url}\nPage Data: ${pageData}\nGenerate a single, concise, one-line action item (max 1 sentence) for the user, in this format:\nAction: <one-liner action item>`;
    try {
      const API_KEY = 'AIzaSyDCV74Ius71fdKhB6_YiXeUGCII8ak_3Wg';
      const requestBody = {
        contents: [{
          parts: [{ text: prompt }]
        }]
      };
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('No response generated from Gemini API');
      }
      const generatedText = data.candidates[0]?.content?.parts?.[0]?.text || 'No action generated';
      const actionMatch = generatedText.match(/Action:\s*(.+)/i);
      return actionMatch ? actionMatch[1].trim() : generatedText.trim();
    } catch (error) {
      throw new Error(`Failed to generate action item: ${error.message}`);
    }
  }
}
