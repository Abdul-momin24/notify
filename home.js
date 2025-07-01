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
