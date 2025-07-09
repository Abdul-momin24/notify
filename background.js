class FloatyBackground {
  constructor() {
    this.init()
  }

  init() {
    chrome.runtime.onInstalled.addListener(() => {
      this.setupDefaultSettings()
    })

    // Listen for hotkey commands
    chrome.commands && chrome.commands.onCommand && chrome.commands.onCommand.addListener((command) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs.length > 0) {
          switch (command) {
            case 'toggle-dictation':
              chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleDictationHotkey' })
              break
            case 'quick-note':
              chrome.tabs.sendMessage(tabs[0].id, { action: 'quickNoteHotkey' })
              break
            case 'read-aloud':
              chrome.tabs.sendMessage(tabs[0].id, { action: 'readAloudHotkey' })
              break
            case 'search-notes':
              chrome.tabs.sendMessage(tabs[0].id, { action: 'searchNotesHotkey' })
              break
          }
        }
      })
    })

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // 1. Test connection
      if (message.action === 'test') {
        sendResponse({ success: true })
        return true
      }

      // 2. Detect tasks
      if (message.action === 'detectTasks') {
        const tasks = this.extractTasksFromText(message.text || '')
        sendResponse({ success: true, actionItems: tasks.length, tasks })
        return true
      }

      // 3. Save selected text + tasks
      if (message.action === 'saveSelectedText') {
        chrome.storage.local.get({ notes: [] }, (result) => {
          const notes = result.notes || []
          const newNote = {
            id: message.id || Date.now() + Math.floor(Math.random() * 1000000), // Unique id
            text: message.text,
            content: message.text, // Ensure highlighted text is also saved as 'content'
            url: message.url,
            title: message.title,
            context: message.context || ' ',
            date: new Date().toISOString(),
            tasks: message.tasks || [],
            actionItems: (message.tasks || []).map(task =>
              typeof task === 'string' ? { text: task, completed: false } : task
            )
          }

          notes.push(newNote)
          chrome.storage.local.set({ notes }, () => {
            console.log('✔️ Note saved:', newNote)
            sendResponse({ success: true })
          })
        })

        // ✅ Important to keep the response channel open for async set()
        return true
      }

      // 4. Save highlight
      if (message.action === 'saveHighlight') {
        chrome.storage.local.get({ highlights: [] }, (result) => {
          const highlights = result.highlights || []
          const newHighlight = {
            id: message.id || Date.now() + Math.floor(Math.random() * 1000000), // Unique id
            content: message.text,
            title: message.title || 'Highlighted Text',
            context: message.context || '',
            url: message.url || '',
            pageTitle: message.pageTitle || '',
            date: new Date().toISOString(),
            // Robust highlight info for restoration
            startXPath: message.startXPath,
            startOffset: message.startOffset,
            endXPath: message.endXPath,
            endOffset: message.endOffset
          }

          console.log('[Floaty][BG] Saving new highlight:', newHighlight)
          highlights.push(newHighlight)
          chrome.storage.local.set({ highlights }, () => {
            console.log('[Floaty][BG] All highlights after save:', highlights)
            sendResponse({ success: true })
          })
        })

        // ✅ Important to keep the response channel open for async set()
        return true
      }

      // 5. Add tasks from content script
      if (message.action === 'addTasksFromContent') {
        chrome.storage.local.get({ tasks: [] }, (result) => {
          const tasks = result.tasks || []
          const newTasks = message.tasks.map(taskText => ({
            id: Date.now() + Math.floor(Math.random() * 1000000),
            text: taskText,
            completed: false,
            createdAt: new Date().toISOString(),
            source: {
              text: message.sourceText,
              url: message.url,
              pageTitle: message.pageTitle
            }
          }))

          tasks.unshift(...newTasks)
          chrome.storage.local.set({ tasks }, () => {
            console.log('✔️ Tasks added from content:', newTasks)
            sendResponse({ success: true, addedCount: newTasks.length })
            
            // Notify popup about new tasks
            chrome.runtime.sendMessage({
              action: 'tasksAdded',
              count: newTasks.length
            }).catch(() => {
              // Popup might not be open, ignore error
            })
          })
        })

        // ✅ Important to keep the response channel open for async set()
        return true
      }

      // 4. Speech-to-text & note focus
      if (message.action === 'speechToText') {
        sendResponse({ success: true })
        return true
      }

      if (message.action === 'focusNote') {
        sendResponse({ success: true })
        return true
      }

      // 6. Get highlights for a specific page
      if (message.action === 'getHighlightsForPage') {
        chrome.storage.local.get({ highlights: [] }, (result) => {
          const url = message.url;
          // Return highlights for this URL only
          const pageHighlights = (result.highlights || []).filter(h => h.url === url);
          sendResponse({ success: true, highlights: pageHighlights });
        });
        return true;
      }

      if (message.action === "loadData") {
        chrome.storage.local.get({ notes: [], highlights: [], tasks: [] }, (result) => {
          // Filter highlights to only those from the last 30 days
          const now = Date.now();
          const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
          const filteredHighlights = (result.highlights || []).filter(h => {
            if (!h.date) return true; // Defensive: keep if no date
            const highlightTime = new Date(h.date).getTime();
            return now - highlightTime <= THIRTY_DAYS_MS;
          });
          // Optionally, clean up expired highlights in storage
          if (filteredHighlights.length !== (result.highlights || []).length) {
            chrome.storage.local.set({ highlights: filteredHighlights });
          }
          console.log('[Floaty][BG] Loading highlights:', filteredHighlights.length, filteredHighlights)
          // Convert notes to the expected format
          const savedItems = (result.notes || []).map(note => ({
            id: note.id,
            title: note.title || note.text || 'Untitled Note',
            content: note.content || note.text || '',
            text: note.text || note.content || '',
            context: note.context || '',
            actionItems: note.actionItems || [],
            summary: note.summary || '',
            tasks: note.tasks || [],
            savedAt: note.date || note.savedAt || new Date().toISOString(),
            url: note.url || '',
            pageTitle: note.pageTitle || ''
          }));
          sendResponse({
            success: true,
            data: {
              notes: savedItems,
              savedItems: savedItems,
              highlights: filteredHighlights,
              tasks: result.tasks || []
            }
          });
        });
        return true; // Keep channel open for async response
      }

      // Unknown action
      sendResponse({ success: false, error: 'Unknown action' })
      return true
    })
  }

  setupDefaultSettings() {
    const defaultSettings = {
      speechEnabled: true,
      autoSave: true,
      darkMode: false,
      notifications: true,
    }

    chrome.storage.local.set({ settings: defaultSettings })
  }

  extractTasksFromText(text) {
    if (!text || !text.trim()) {
      return []
    }

    const tasks = []
    const cleanText = text.trim()
    
    // Split by common delimiters - be more aggressive in splitting
    const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const lines = cleanText.split(/\n+/).filter(l => l.trim().length > 0)
    const bulletPoints = cleanText.split(/(?:\n|^)\s*[-•*]\s+/).filter(b => b.trim().length > 0)
    const numberedItems = cleanText.split(/(?:\n|^)\s*\d+[\.\)]\s+/).filter(n => n.trim().length > 0)
    
    // Action keywords that indicate tasks
    const actionKeywords = [
      'todo', 'task', 'do', 'complete', 'call', 'email', 'buy', 'get', 'make', 
      'check', 'schedule', 'need', 'should', 'must', 'remember', 'follow up', 
      'review', 'update', 'create', 'write', 'send', 'prepare', 'organize', 
      'plan', 'book', 'order', 'arrange', 'set up', 'install', 'download', 
      'upload', 'submit', 'apply', 'register', 'sign up', 'contact', 'meet',
      'attend', 'join', 'leave', 'start', 'finish', 'stop', 'continue',
      'research', 'study', 'learn', 'practice', 'train', 'exercise',
      'clean', 'wash', 'cook', 'shop', 'pay', 'transfer', 'deposit',
      'withdraw', 'save', 'invest', 'budget', 'track', 'monitor', 'find',
      'look', 'search', 'go', 'visit', 'return', 'pick up', 'drop off',
      'confirm', 'verify', 'test', 'try', 'use', 'open', 'close', 'lock',
      'unlock', 'turn on', 'turn off', 'switch', 'change', 'replace', 'fix',
      'repair', 'maintain', 'update', 'upgrade', 'backup', 'restore', 'sync'
    ]

    // Priority keywords that make something more likely to be a task
    const priorityKeywords = [
      'urgent', 'important', 'critical', 'asap', 'deadline', 'due',
      'priority', 'high priority', 'low priority', 'essential', 'necessary',
      'required', 'mandatory', 'obligatory', 'compulsory', 'needed', 'wanted'
    ]

    // Process all possible segments
    const allSegments = [...sentences, ...lines, ...bulletPoints, ...numberedItems]
    
    for (const segment of allSegments) {
      const trimmed = segment.trim()
      if (trimmed.length < 3 || trimmed.length > 200) continue // Lower minimum length
      
      const lowerSegment = trimmed.toLowerCase()
      
      // Check if this segment contains task indicators
      const hasActionKeyword = actionKeywords.some(keyword => lowerSegment.includes(keyword))
      const hasPriorityKeyword = priorityKeywords.some(keyword => lowerSegment.includes(keyword))
      const startsWithAction = /^[A-Z][a-z]+\b/.test(trimmed) // Starts with capitalized word
      const hasBulletPoint = trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')
      const hasTodo = /^todo\b/i.test(trimmed)
      const hasQuestion = trimmed.includes('?') && trimmed.length < 100 // Questions often indicate tasks
      const hasTimeReference = /\b(today|tomorrow|next|this week|this month|by|before|after|until)\b/i.test(trimmed)
      const hasNumber = /\d+/.test(trimmed) // Contains numbers (often indicates tasks)
      const isShortPhrase = trimmed.split(' ').length <= 8 // Short phrases are often tasks
      
      // Score the segment based on task indicators
      let score = 0
      if (hasActionKeyword) score += 4
      if (hasPriorityKeyword) score += 3
      if (startsWithAction) score += 2
      if (hasBulletPoint) score += 3
      if (hasTodo) score += 5
      if (hasQuestion) score += 2
      if (hasTimeReference) score += 2
      if (hasNumber) score += 1
      if (isShortPhrase) score += 1
      
      // Lower threshold to catch more potential tasks
      if (score >= 1) {
        // Clean up the task text
        let taskText = trimmed
        
        // Remove bullet points, TODO prefixes, and numbers
        taskText = taskText.replace(/^[-•*]\s*/, '').replace(/^todo\s*:?\s*/i, '').replace(/^\d+[\.\)]\s*/, '')
        
        // Capitalize first letter if needed
        if (taskText.length > 0 && !/[A-Z]/.test(taskText[0])) {
          taskText = taskText.charAt(0).toUpperCase() + taskText.slice(1)
        }
        
        // Truncate if too long (max 2 lines, ~120 characters)
        if (taskText.length > 120) {
          const words = taskText.split(' ')
          let truncated = ''
          for (const word of words) {
            if ((truncated + ' ' + word).length <= 120) {
              truncated += (truncated ? ' ' : '') + word
            } else {
              break
            }
          }
          taskText = truncated + (truncated.length < taskText.length ? '...' : '')
        }
        
        // Only add if it's not already in the list and is meaningful
        if (taskText.length >= 3 && !tasks.includes(taskText)) {
          tasks.push(taskText)
        }
      }
    }
    
    // If still no tasks found, try to break down longer sentences into potential tasks
    if (tasks.length === 0) {
      const longSentences = sentences.filter(s => s.length > 20 && s.length < 100)
      for (const sentence of longSentences) {
        // Look for action words and create tasks around them
        const actionMatches = actionKeywords.filter(keyword => 
          sentence.toLowerCase().includes(keyword)
        )
        
        if (actionMatches.length > 0) {
          // Create a task from the sentence
          let taskText = sentence.trim()
          if (taskText.length > 80) {
            taskText = taskText.substring(0, 77) + '...'
          }
          tasks.push(taskText)
        }
      }
    }
    
    // If still no tasks, create simple tasks from the text
    if (tasks.length === 0) {
      const words = cleanText.split(/\s+/)
      if (words.length > 3) {
        // Create tasks from meaningful sentences
        const meaningfulSentences = sentences.filter(s => s.length > 10 && s.length < 80)
        for (const sentence of meaningfulSentences.slice(0, 3)) {
          let simpleTask = sentence.trim()
          if (simpleTask.length > 80) {
            simpleTask = simpleTask.substring(0, 77) + '...'
          }
          tasks.push(simpleTask)
        }
      }
    }
    
    // Remove duplicates and limit to maximum 8 tasks
    const uniqueTasks = [...new Set(tasks)]
    return uniqueTasks.slice(0, 8)
  }
}

// Init
new FloatyBackground()

// Debug
chrome.storage.local.get('notes', data => {
  console.log('📒 Stored Notes:', data.notes)
})
