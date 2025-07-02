// Save/load Gemini API key
const apiKeyInput = document.getElementById('api-key');
const saveApiKeyBtn = document.getElementById('save-api-key');
const notesList = document.getElementById('notes-list');
const summarizeBtn = document.getElementById('summarize-notes');
const summaryText = document.getElementById('summary-text');

// Load API key
apiKeyInput.value = localStorage.getItem('geminiApiKey') || '';

saveApiKeyBtn.onclick = () => {
  localStorage.setItem('geminiApiKey', apiKeyInput.value);
  alert('API key saved!');
};

// Load notes from chrome.storage.local
function loadNotes() {
  chrome.storage.local.get({ webNotes: [] }, (result) => {
    notesList.innerHTML = '';
    const notes = result.webNotes;
    notes.forEach((note, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${note.text}</strong><br><small>${note.url} | ${note.date}</small>`;
      notesList.appendChild(li);
    });
  });
}

// Initial load
loadNotes();

// Listen for changes in storage to update notes in real time
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.webNotes) {
    loadNotes();
  }
});

// Summarize notes
summarizeBtn.onclick = async () => {
  const apiKey = localStorage.getItem('geminiApiKey');
  if (!apiKey) {
    alert('Please enter your Gemini API key.');
    return;
  }
  chrome.storage.local.get({ webNotes: [] }, async (result) => {
    const notes = result.webNotes;
    if (notes.length === 0) {
      alert('No notes to summarize.');
      return;
    }
    summaryText.textContent = 'Summarizing...';
    try {
      // Placeholder for Gemini API call
      const summary = await summarizeWithGemini(apiKey, notes);
      summaryText.textContent = summary;
    } catch (e) {
      summaryText.textContent = 'Error: ' + e.message;
    }
  });
};

// Placeholder Gemini API call
async function summarizeWithGemini(apiKey, notes) {
  // TODO: Implement Gemini API call
  return '[Summary will appear here]';
} 


document.getElementById('viewNotes').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('../pages/home.html') });
});
