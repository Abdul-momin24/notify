function renderNotes(notes) {
  const container = document.getElementById('notes');
  container.innerHTML = '';

  if (notes.length === 0) {
    container.textContent = 'No notes saved yet.';
    return;
  }

  notes.forEach((note) => {
    const div = document.createElement('div');
    div.className = 'note';
    div.innerHTML = `
      <div class="context"><strong>Context:</strong> ${note.context}</div>
      <div class="text">${note.text}</div>
      <div class="url"><a href="${note.url}" target="_blank">${note.url}</a></div>
      <div class="date">${note.date}</div>
    `;
    container.appendChild(div);
  });
}

// Load notes
chrome.storage.local.get({ webNotes: [] }, (result) => {
  renderNotes(result.webNotes);
});

// Clear notes
document.getElementById('clear').addEventListener('click', () => {
  if (confirm('Clear all notes?')) {
    chrome.storage.local.set({ webNotes: [] }, () => {
      renderNotes([]);
    });
  }
});

// Save note
function saveNote() {
  const noteText = document.getElementById('note-input').value.trim();
  const context = document.getElementById('context-input').value.trim();
  if (!noteText || !context) {
    alert('Please enter both a note and its context.');
    return;
  }
  // Get current tab URL
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    const url = tabs[0]?.url || '';
    const date = new Date().toLocaleString();
    const newNote = { text: noteText, context, url, date };
    chrome.storage.local.get({ webNotes: [] }, (result) => {
      const updatedNotes = [newNote, ...result.webNotes];
      chrome.storage.local.set({ webNotes: updatedNotes }, () => {
        renderNotes(updatedNotes);
        document.getElementById('note-input').value = '';
        document.getElementById('context-input').value = '';
      });
    });
  });
}

document.getElementById('save-note').addEventListener('click', saveNote);

// Speech-to-Text (Web Speech API)
let recognition;
let isListening = false;

// Add interim overlay below textarea if not present
if (!document.getElementById('interim-overlay')) {
  const noteInput = document.getElementById('note-input');
  const overlay = document.createElement('div');
  overlay.id = 'interim-overlay';
  overlay.style.color = '#888';
  overlay.style.fontSize = '13px';
  overlay.style.minHeight = '18px';
  overlay.style.marginTop = '2px';
  noteInput.parentNode.insertBefore(overlay, noteInput.nextSibling);
}

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
      const textarea = document.getElementById('note-input');
      const overlay = document.getElementById('interim-overlay');
      if (textarea) {
        if (final) {
          textarea.value = textarea.value.replace(/\s+$/, '') + final;
        }
      }
      if (overlay) {
        overlay.textContent = interim;
      }
    };
    recognition.onerror = (e) => {
      stopSpeechRecognition();
    };
    recognition.onend = () => {
      stopSpeechRecognition();
      const overlay = document.getElementById('interim-overlay');
      if (overlay) overlay.textContent = '';
    };
  }
  if (!isListening) {
    recognition.start();
    isListening = true;
    document.getElementById('listening-indicator').style.display = 'inline';
    document.getElementById('mic-icon').textContent = '🛑';
  } else {
    stopSpeechRecognition();
  }
}

function stopSpeechRecognition() {
  if (recognition && isListening) {
    recognition.stop();
    isListening = false;
    document.getElementById('listening-indicator').style.display = 'none';
    document.getElementById('mic-icon').textContent = '🎤';
    const overlay = document.getElementById('interim-overlay');
    if (overlay) overlay.textContent = '';
  }
}

document.getElementById('mic-btn').addEventListener('click', toggleSpeechRecognition);

document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.shiftKey && e.code === 'KeyM') {
    e.preventDefault();
    toggleSpeechRecognition();
  }
});

// Tab switching logic
function showSection(section) {
  document.getElementById('current-tab-section').style.display = section === 'current' ? '' : 'none';
  document.getElementById('saved-notes-section').style.display = section === 'saved' ? '' : 'none';
  document.getElementById('action-items-section').style.display = section === 'actions' ? '' : 'none';
  document.getElementById('tab-current').classList.toggle('active', section === 'current');
  document.getElementById('tab-saved').classList.toggle('active', section === 'saved');
  document.getElementById('tab-actions').classList.toggle('active', section === 'actions');
}
document.getElementById('tab-current').addEventListener('click', () => showSection('current'));
document.getElementById('tab-saved').addEventListener('click', () => showSection('saved'));
document.getElementById('tab-actions').addEventListener('click', () => showSection('actions'));
// Set default tab
showSection('current');

// Action Items logic
function renderActionItems(items) {
  const container = document.getElementById('action-items-list');
  container.innerHTML = '';
  if (!items || items.length === 0) {
    container.textContent = 'No action items yet.';
    return;
  }
  items.forEach((item, idx) => {
    const label = document.createElement('label');
    label.style.display = 'block';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'action-item';
    radio.value = item;
    label.appendChild(radio);
    label.appendChild(document.createTextNode(' ' + item));
    container.appendChild(label);
  });
}

function loadActionItems() {
  chrome.storage.local.get({ actionItems: [] }, (result) => {
    renderActionItems(result.actionItems);
  });
}

// Add Create Action Item logic
async function callGeminiAPI(context, note, url) {
  // Placeholder: Replace with real Gemini API call
  // Return a promise that resolves to a generated action string
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(`Action: ${context} | ${note.substring(0, 30)}... | ${url}`);
    }, 2000);
  });
}

document.getElementById('create-action-btn').addEventListener('click', async () => {
  const context = document.getElementById('context-input').value.trim();
  const note = document.getElementById('note-input').value.trim();
  const url = window.location.href;
  if (!context || !note) {
    alert('Please enter both context and note.');
    return;
  }
  const loading = document.getElementById('action-loading');
  loading.style.display = '';
  try {
    const actionTask = await callGeminiAPI(context, note, url);
    chrome.storage.local.get({ actionItems: [] }, (result) => {
      const updated = [...result.actionItems, actionTask];
      chrome.storage.local.set({ actionItems: updated }, () => {
        renderActionItems(updated);
        showSection('actions');
        loading.style.display = 'none';
      });
    });
  } catch (e) {
    alert('Failed to generate action item.');
    loading.style.display = 'none';
  }
});

// Render action items when switching to Action Items tab
const tabActions = document.getElementById('tab-actions');
tabActions.addEventListener('click', loadActionItems);
// Initial load
loadActionItems();
