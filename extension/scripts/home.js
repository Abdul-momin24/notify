// Remove Node.js require and use browser-based API calls
// const GoogleGenAI = require('@google/genai');
// const ai = new GoogleGenAI({apiKey:'AIzaSyDCV74Ius71fdKhB6_YiXeUGCII8ak_3Wg'});

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
function stripActionPrefix(text) {
  return text.replace(/^\s*(Action Task:|Action:)\s*/i, '');
}
function renderActionItems(items) {
  const container = document.getElementById('action-items-list');
  container.innerHTML = '';
  if (!items || items.length === 0) {
    container.textContent = 'No action items yet.';
    return;
  }
  items.forEach((item, idx) => {
    const label = document.createElement('label');
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.gap = '8px';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'action-checkbox';
    checkbox.value = idx;
    const span = document.createElement('span');
    span.textContent = stripActionPrefix(item);
    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑️';
    delBtn.title = 'Delete this action item';
    delBtn.style.marginLeft = '8px';
    delBtn.onclick = () => deleteActionItem(idx);
    label.appendChild(checkbox);
    label.appendChild(span);
    label.appendChild(delBtn);
    container.appendChild(label);
  });
}
function deleteActionItem(idx) {
  chrome.storage.local.get({ actionItems: [] }, (result) => {
    const updated = result.actionItems.filter((_, i) => i !== idx);
    chrome.storage.local.set({ actionItems: updated }, () => {
      renderActionItems(updated);
    });
  });
}
document.getElementById('delete-selected-actions').addEventListener('click', () => {
  chrome.storage.local.get({ actionItems: [] }, (result) => {
    const checkboxes = document.querySelectorAll('.action-checkbox');
    const toDelete = Array.from(checkboxes).map((cb, i) => cb.checked ? i : -1).filter(i => i !== -1);
    const updated = result.actionItems.filter((_, i) => !toDelete.includes(i));
    chrome.storage.local.set({ actionItems: updated }, () => {
      renderActionItems(updated);
    });
  });
});

function loadActionItems() {
  chrome.storage.local.get({ actionItems: [] }, (result) => {
    renderActionItems(result.actionItems);
  });
}

function getVisiblePageText() {
  // Get visible text from the body (limit to 2000 chars for prompt size)
  return document.body.innerText.slice(0, 2000);
}

// Update Create Action Item logic
async function callGeminiAPI(context, note, url, pageData) {
  const prompt = `Context: ${context}\nNote: ${note}\nURL: ${url}\nPage Data: ${pageData}\nGenerate a single, concise, one-line action item (max 1 sentence) for the user, in this format:\nAction: <one-liner action item> dont add the adress of extension a meaningfull task item`;

  try {
    const API_KEY = 'AIzaSyDCV74Ius71fdKhB6_YiXeUGCII8ak_3Wg';
    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    };
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
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

// Update Create Action Item button handler
const createActionBtn = document.getElementById('create-action-btn');
if (createActionBtn) {
  createActionBtn.addEventListener('click', async () => {
    const context = document.getElementById('context-input').value.trim();
    const note = document.getElementById('note-input').value.trim();
    const url = window.location.href;
    const pageData = getVisiblePageText();

    if (!context || !note) {
      alert('Please enter both context and note.');
      return;
    }

    const loading = document.getElementById('action-loading');
    loading.style.display = '';
    if (typeof showToast === 'function') showToast('Generating action item...');

    try {
      const actionTask = await callGeminiAPI(context, note, url, pageData);
      chrome.storage.local.get({ actionItems: [] }, (result) => {
        const updated = [...result.actionItems, actionTask];
        chrome.storage.local.set({ actionItems: updated }, () => {
          renderActionItems(updated);
          showSection('actions');
          loading.style.display = 'none';
          if (typeof showToast === 'function') showToast('Action item created!');
        });
      });
    } catch (e) {
      alert(`Failed to generate action item: ${e.message}`);
      loading.style.display = 'none';
    }
  });
}

// Render action items when switching to Action Items tab
const tabActions = document.getElementById('tab-actions');
tabActions.addEventListener('click', loadActionItems);
// Initial load
loadActionItems();
