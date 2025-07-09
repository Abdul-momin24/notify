// Floaty Content Script - Handles text selection and popup display
// Simplified version with just button actions

class FloatyContentScript {
  constructor() {
    this.popup = null
    this.isVisible = false
    this.selectedText = ""
    this.selectedRange = null
    this.currentUrl = window.location.href
    this.currentPageTitle = document.title
    this.debounceTimer = null
    this.contextCheckInterval = null
    this.init()
    this.restoreHighlightsOnLoad();
  }

  init() {
    console.log('Floaty content script initializing...')
    
    // Always set up event listeners first
    this.setupEventListeners()
    this.setupHotkeys()
    
    // Check if extension context is valid for background communication
    if (this.isExtensionContextValid()) {
      // Test connection to background script
      this.testBackgroundConnection()
      
      // Start periodic context checking
      this.startContextChecking()
      
      console.log('Floaty: Extension context valid - background communication enabled')
    } else {
      console.warn('Floaty: Extension context not available - background features disabled')
    }
    
    console.log('Floaty content script initialized')
  }

  isExtensionContextValid() {
    return typeof chrome !== 'undefined' && 
           chrome.runtime && 
           chrome.runtime.id
  }

  async attemptReconnection() {
    if (this.isExtensionContextValid()) {
      return true;
    }

    console.log('Floaty: Attempting to reconnect to extension...');
    
    // Wait a bit and try again
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (this.isExtensionContextValid()) {
      console.log('Floaty: Reconnection successful');
      this.showNotification('Extension reconnected!', 'success');
      return true;
    }
    
    console.error('Floaty: Reconnection failed');
    return false;
  }

  testBackgroundConnection() {
    if (!this.isExtensionContextValid()) {
      console.error('Floaty: Cannot test background connection - context invalid')
      return
    }
    
    chrome.runtime.sendMessage({ action: 'test' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Floaty: Background connection failed:', chrome.runtime.lastError)
      } else if (response && response.success) {
        console.log('Floaty: Background script connection successful')
      } else {
        console.error('Floaty: Background script connection failed - no response')
      }
    })
  }

  startContextChecking() {
    // Check context every 10 seconds for more responsive detection
    this.contextCheckInterval = setInterval(() => {
      if (!this.isExtensionContextValid()) {
        console.warn('Floaty: Extension context became invalid - stopping context checking')
        this.stopContextChecking()
        this.showNotification('Extension context lost. Please refresh the page.', 'error')
        
        // Hide popup if it's visible
        if (this.isVisible) {
          this.hidePopup()
        }
      }
    }, 10000)
  }

  stopContextChecking() {
    if (this.contextCheckInterval) {
      clearInterval(this.contextCheckInterval)
      this.contextCheckInterval = null
    }
  }

  setupEventListeners() {
    // Text selection events
    document.addEventListener('mouseup', (e) => this.handleTextSelection(e))
    document.addEventListener('keyup', (e) => this.handleTextSelection(e))
    
    // Hide popup when clicking outside
    document.addEventListener('click', (e) => {
      if (this.popup && !this.popup.contains(e.target)) {
        this.hidePopup()
      }
    })

    // Hide popup on scroll
    document.addEventListener('scroll', () => {
      if (this.isVisible) {
        this.hidePopup()
      }
    })

    // Handle escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hidePopup()
      }
    })

    // Handle page visibility changes (when user switches tabs or minimizes)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.isVisible) {
        this.hidePopup()
      }
    })

    // Handle beforeunload to clean up
    window.addEventListener('beforeunload', () => {
      this.stopContextChecking()
    })
  }

  setupHotkeys() {
    // Listen for hotkeys from background script
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+D for speech-to-text
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        this.activateSpeechToText()
      }
      
      // Ctrl+Shift+N for note-taking
      if (e.ctrlKey && e.shiftKey && e.key === 'N') {
        e.preventDefault()
        this.activateNoteTaking()
      }
    })
  }

  handleTextSelection(event) {
    // Debounce the selection handling
    clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      this.processTextSelection()
    }, 100)
  }

  processTextSelection() {
    const selection = window.getSelection()
    const text = selection.toString().trim()

    console.log('Floaty: Text selection detected:', text.length > 0 ? `"${text.substring(0, 50)}..."` : 'empty')

    // Increased limit and better handling of complex selections
    if (text.length > 0 && text.length < 50000) {
      this.selectedText = text
      // Store the range for highlighting
      if (selection.rangeCount > 0) {
        this.selectedRange = selection.getRangeAt(0).cloneRange()
      }
      this.showPopup(selection)
    } else if (text.length >= 50000) {
      this.showNotification('Selection too large. Please select a smaller portion.', 'warning')
      this.hidePopup()
    } else {
      this.hidePopup()
    }
  }

  showPopup(selection) {
    console.log('Floaty: Showing popup')
    
    if (this.isVisible) {
      this.updatePopupPosition(selection)
      return
    }

    this.createPopup()
    this.updatePopupPosition(selection)
    this.isVisible = true
    console.log('Floaty: Popup created and positioned')
  }

  createPopup() {
    // Remove existing popup
    if (this.popup) {
      document.body.removeChild(this.popup)
    }

    // Create simplified popup with just buttons
    this.popup = document.createElement('div')
    this.popup.id = 'floaty-popup'
    this.popup.innerHTML = `
      <div class="floaty-popup-content">
        <div class="floaty-actions">
          <button class="floaty-action-btn floaty-highlight-btn" title="Highlight text in yellow">
            <span class="floaty-btn-text">Highlight</span>
          </button>
          <button class="floaty-action-btn floaty-save-btn" title="Save to notes">
            <span class="floaty-btn-text">Save</span>
          </button>
          <button class="floaty-action-btn floaty-copy-btn" title="Copy to clipboard">
            <span class="floaty-btn-text">Copy</span>
          </button>
          <button class="floaty-action-btn floaty-tasks-btn" title="Extract tasks">
            <span class="floaty-btn-text">Tasks</span>
          </button>
        </div>
      </div>
    `

    // Add event listeners
    const highlightBtn = this.popup.querySelector('.floaty-highlight-btn')
    const copyBtn = this.popup.querySelector('.floaty-copy-btn')
    const saveBtn = this.popup.querySelector('.floaty-save-btn')
    const tasksBtn = this.popup.querySelector('.floaty-tasks-btn')

    highlightBtn.addEventListener('click', () => this.highlightText())
    copyBtn.addEventListener('click', () => this.copyText())
    saveBtn.addEventListener('click', () => this.saveToNotes())
    tasksBtn.addEventListener('click', () => this.showTasksDialog())

    // Add to page
    document.body.appendChild(this.popup)
    this.addPopupStyles()
  }

  updatePopupPosition(selection) {
    if (!this.popup || !selection.rangeCount) return

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    
    // Calculate position for compact button popup
    const popupWidth = 280
    const popupHeight = 60
    const padding = 20
    
    let left = rect.left + (rect.width / 2) - (popupWidth / 2)
    let top = rect.bottom + padding + window.scrollY

    // Adjust for viewport boundaries
    if (left < padding) left = padding
    if (left + popupWidth > window.innerWidth - padding) {
      left = window.innerWidth - popupWidth - padding
    }
    
    if (top + popupHeight > window.innerHeight + window.scrollY - padding) {
      top = rect.top + window.scrollY - popupHeight - padding
    }

    // Apply position
    this.popup.style.left = `${left}px`
    this.popup.style.top = `${top}px`
  }

  hidePopup() {
    if (this.popup) {
      this.popup.style.animation = 'floatySlideOut 0.2s ease forwards'
      setTimeout(() => {
        if (this.popup && this.popup.parentNode) {
          this.popup.parentNode.removeChild(this.popup)
        }
        this.popup = null
        this.isVisible = false
        // Clear stored data when popup is hidden
        this.selectedText = ""
        this.selectedRange = null
      }, 200)
    }
  }

  // Utility: Get XPath of a node (robust for text nodes)
  getXPath(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      // Get the index of this text node among all text nodes in the parent
      const parent = node.parentNode;
      const textNodes = Array.from(parent.childNodes).filter(n => n.nodeType === Node.TEXT_NODE);
      const idx = textNodes.indexOf(node) + 1;
      return this.getXPath(parent) + `/text()[${idx}]`;
    }
    if (node.id) return `//*[@id="${node.id}"]`;
    if (node === document.body) return '/html/body';
    const ix = Array.from(node.parentNode.childNodes)
      .filter(n => n.nodeName === node.nodeName)
      .indexOf(node) + 1;
    return this.getXPath(node.parentNode) + '/' + node.nodeName.toLowerCase() + `[${ix}]`;
  }

  // Utility: Find node by XPath
  getNodeByXPath(xpath) {
    return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
  }

  highlightText() {
    if (!this.selectedText || !this.selectedRange) {
      console.log('Floaty: No text or range to highlight')
      this.showNotification('No text selected to highlight', 'error')
      return
    }

    try {
      console.log('Floaty: Attempting to highlight text:', this.selectedText.substring(0, 50) + '...')
      // Save the highlight to storage with robust info
      this.saveHighlightWithRange(this.selectedRange);
      // Create highlight span
      const span = document.createElement('span')
      span.style.backgroundColor = '#fff3cd'
      span.style.borderBottom = '2px solid #ffc107'
      span.style.padding = '2px 0'
      span.className = 'floaty-highlight'
      // Handle complex DOM structures (like Wikipedia links)
      const range = this.selectedRange.cloneRange()
      const contents = range.extractContents()
      // Preserve existing links and formatting
      const fragment = document.createDocumentFragment()
      const walker = document.createTreeWalker(
        contents,
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
        null,
        false
      )
      let node
      while (node = walker.nextNode()) {
        if (node.nodeType === Node.TEXT_NODE) {
          // Wrap text nodes in highlight span
          const textSpan = span.cloneNode(true)
          textSpan.textContent = node.textContent
          fragment.appendChild(textSpan)
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          // Preserve existing elements (links, etc.) but add highlight styling
          const element = node.cloneNode(true)
          element.style.backgroundColor = '#fff3cd'
          element.style.borderBottom = '2px solid #ffc107'
          element.style.padding = '2px 0'
          element.classList.add('floaty-highlight')
          fragment.appendChild(element)
        }
      }
      // Insert the highlighted content back
      range.insertNode(fragment)
      // Removed: this.saveHighlight()
      console.log('Floaty: Text highlighted successfully')
      this.showNotification('Text highlighted!', 'success')
      this.hidePopup()
    } catch (error) {
      console.error('Floaty: Failed to highlight text:', error)
      // Fallback to simple highlighting
      try {
        const span = document.createElement('span')
        span.style.backgroundColor = '#fff3cd'
        span.style.borderBottom = '2px solid #ffc107'
        span.style.padding = '2px 0'
        span.className = 'floaty-highlight'
        this.selectedRange.surroundContents(span)
        // Removed: this.saveHighlight()
        console.log('Floaty: Text highlighted with fallback method')
        this.showNotification('Text highlighted!', 'success')
        this.hidePopup()
      } catch (fallbackError) {
        console.error('Floaty: Fallback highlighting also failed:', fallbackError)
        this.showNotification('Failed to highlight text. Selection may be too complex.', 'error')
      }
    }
  }

  // Save highlight with DOM path and offsets
  saveHighlightWithRange(range) {
    const startContainer = range.startContainer;
    const endContainer = range.endContainer;
    const startOffset = range.startOffset;
    const endOffset = range.endOffset;
    const startXPath = this.getXPath(startContainer);
    const endXPath = this.getXPath(endContainer);
    const message = {
      action: 'saveHighlight',
      text: this.selectedText,
      url: this.currentUrl,
      title: this.currentPageTitle,
      pageTitle: this.currentPageTitle,
      context: 'From webpage highlight',
      startXPath,
      startOffset,
      endXPath,
      endOffset
    };
    console.log('[Floaty][CS] Sending saveHighlight message:', message);
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Floaty][CS] Runtime error saving highlight:', chrome.runtime.lastError)
        return;
      }
      console.log('[Floaty][CS] Save highlight response:', response);
      if (response && response.success) {
        console.log('Floaty: Highlight saved successfully')
      } else {
        console.error('Floaty: Failed to save highlight')
      }
    })
  }

  addPopupStyles() {
    if (document.getElementById('floaty-popup-styles')) return

    const styles = document.createElement('style')
    styles.id = 'floaty-popup-styles'
    styles.textContent = `
      #floaty-popup {
        position: absolute;
        z-index: 10000;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
        border: 1px solid rgba(0, 0, 0, 0.08);
        animation: floatySlideIn 0.3s ease;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        width: 280px;
        min-width: 220px;
        max-width: 320px;
        overflow: hidden;
      }

      @keyframes floatySlideIn {
        from {
          opacity: 0;
          transform: translateY(-10px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @keyframes floatySlideOut {
        from {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        to {
          opacity: 0;
          transform: translateY(-10px) scale(0.95);
        }
      }

      .floaty-popup-content {
        display: flex;
        padding: 12px;
        box-sizing: border-box;
      }

      .floaty-actions {
        display: flex;
        gap: 6px;
        width: 100%;
      }

      .floaty-action-btn {
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        color: #495057;
        padding: 8px 6px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 500;
        transition: all 0.2s ease;
        flex: 1 1 0;
        min-width: 0;
        max-width: 70px;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        box-sizing: border-box;
      }

      .floaty-action-btn:hover {
        background: #e9ecef;
        border-color: #dee2e6;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .floaty-btn-text {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 48px;
        display: inline-block;
        text-align: center;
      }

      .floaty-copy-btn:hover {
        background: #d4edda;
        border-color: #c3e6cb;
        color: #155724;
      }

      .floaty-highlight-btn:hover {
        background: #fff3cd;
        border-color: #ffeaa7;
        color: #856404;
      }

      .floaty-save-btn:hover {
        background: #d1ecf1;
        border-color: #bee5eb;
        color: #0c5460;
      }

      .floaty-tasks-btn:hover {
        background: #d4edda;
        border-color: #c3e6cb;
        color: #155724;
      }
    `

    document.head.appendChild(styles)
  }

  async copyText() {
    try {
      if (!this.selectedText) {
        this.showNotification('No text selected to copy', 'error');
        return;
      }
      await navigator.clipboard.writeText(this.selectedText)
      this.showNotification('Text copied!', 'success')
      this.hidePopup()
    } catch (error) {
      console.error('Floaty: Failed to copy text:', error)
      this.showNotification('Failed to copy: ' + error.message, 'error')
    }
  }

  async saveToNotes() {
    try {
      if (!this.selectedText) {
        this.showNotification('No text selected to save', 'error');
        return;
      }
      
      // Check if extension context is still valid
      if (!this.isExtensionContextValid()) {
        this.showNotification('Extension context invalid. Please refresh the page.', 'error');
        return;
      }
      
      // Always extract tasks, but always save
      chrome.runtime.sendMessage({
        action: 'detectTasks',
        text: this.selectedText,
        url: this.currentUrl,
        title: this.currentPageTitle,
        context: ''
      }, (taskResponse) => {
        if (chrome.runtime.lastError) {
          console.error('Floaty: Runtime error detecting tasks:', chrome.runtime.lastError);
          this.showNotification('Failed to detect tasks: ' + chrome.runtime.lastError.message, 'error');
          return;
        }
        
        // Ensure tasks are objects with a 'text' property
        const tasks = (taskResponse && taskResponse.success && Array.isArray(taskResponse.tasks))
          ? taskResponse.tasks.map(t => typeof t === 'string' ? { text: t } : t)
          : [];
        
        // Always save, with or without tasks
        chrome.runtime.sendMessage({
          action: 'saveSelectedText',
          text: this.selectedText,
          url: this.currentUrl,
          title: this.currentPageTitle,
          context: '',
          tasks: tasks
        }, (saveResponse) => {
          if (chrome.runtime.lastError) {
            console.error('Floaty: Runtime error saving text:', chrome.runtime.lastError);
            this.showNotification('Failed to save text: ' + chrome.runtime.lastError.message, 'error');
            return;
          }
          
          if (saveResponse && saveResponse.success) {
            this.showNotification('Text saved successfully!', 'success');
          } else {
            this.showNotification('Failed to save text', 'error');
          }
        });
        this.hidePopup();
      });
    } catch (error) {
      console.error('Floaty: Error in saveToNotes:', error);
      this.showNotification('Failed to save: ' + error.message, 'error');
    }
  }

  async saveHighlight() {
    if (!this.selectedText) {
      return;
    }

    // Check if extension context is still valid, try to reconnect if not
    if (!this.isExtensionContextValid()) {
      const reconnected = await this.attemptReconnection();
      if (!reconnected) {
        console.error('Floaty: Cannot save highlight - extension context invalid')
        return;
      }
    }

    try {
      const message = {
        action: 'saveHighlight',
        text: this.selectedText,
        url: this.currentUrl,
        title: this.currentPageTitle,
        pageTitle: this.currentPageTitle,
        context: 'From webpage highlight'
      }
      console.log('[Floaty][CS] Sending saveHighlight message:', message);
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[Floaty][CS] Runtime error saving highlight:', chrome.runtime.lastError)
          return;
        }
        console.log('[Floaty][CS] Save highlight response:', response);
        if (response && response.success) {
          console.log('Floaty: Highlight saved successfully')
        } else {
          console.error('Floaty: Failed to save highlight')
        }
      })
    } catch (error) {
      console.error('Floaty: Error saving highlight:', error)
    }
  }

  async extractTasks() {
    try {
      console.log('Floaty: Attempting to extract tasks from:', this.selectedText.substring(0, 50) + '...');

      if (!this.selectedText) {
        console.error('Floaty: No text selected to extract tasks from');
        this.showNotification('No text selected to extract tasks from', 'error');
        return;
      }

      // Check if extension context is still valid
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
        console.error('Floaty: Extension context invalid - extension may have been reloaded');
        this.showNotification('Extension context invalid. Please refresh the page.', 'error');
        return;
      }

      // Send message to background script to detect tasks
      chrome.runtime.sendMessage({
        action: 'detectTasks',
        text: this.selectedText,
        context: ''
      }, (response) => {
        console.log('Floaty: Detect tasks response:', response);

        if (chrome.runtime.lastError) {
          console.error('Floaty: Runtime error:', chrome.runtime.lastError);
          this.showNotification('Failed to detect tasks: ' + chrome.runtime.lastError.message, 'error');
          return;
        }

        if (response && response.success) {
          this.showNotification(`Tasks detected! (${response.actionItems} tasks found)`, 'success');
          // Now save the text and tasks
          chrome.runtime.sendMessage({
            action: 'saveSelectedText',
            text: this.selectedText,
            url: this.currentUrl,
            title: this.currentPageTitle,
            context: '',
            extractTasks: true,
            tasks: response.tasks // Pass the extracted tasks if you want to store them
          }, (saveResponse) => {
            if (saveResponse && saveResponse.success) {
              this.showNotification('Text and tasks saved!', 'success');
            } else {
              this.showNotification('Failed to save text and tasks', 'error');
            }
          });
        } else {
          const errorMsg = response && response.error ? response.error : 'No tasks found';
          console.error('Floaty: Detect tasks failed:', errorMsg);
          this.showNotification(errorMsg, 'info');
        }
      });

      this.hidePopup();
    } catch (error) {
      console.error('Floaty: Failed to detect tasks:', error);
      this.showNotification('Failed to detect tasks: ' + error.message, 'error');
    }
  }

  async showTasksDialog() {
    if (!this.selectedText) {
      this.showNotification('No text selected to extract tasks from', 'error');
      return;
    }

    // Check if extension context is still valid
    if (!this.isExtensionContextValid()) {
      this.showNotification('Extension context invalid. Please refresh the page.', 'error');
      return;
    }

    try {
      // Send message to background script to detect tasks
      chrome.runtime.sendMessage({
        action: 'detectTasks',
        text: this.selectedText,
        context: ''
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Floaty: Runtime error detecting tasks:', chrome.runtime.lastError);
          this.showNotification('Failed to detect tasks: ' + chrome.runtime.lastError.message, 'error');
          return;
        }

        if (response && response.success && response.tasks && response.tasks.length > 0) {
          this.createTasksDialog(response.tasks);
        } else {
          this.showNotification('No tasks found in the selected text', 'info');
        }
      });
    } catch (error) {
      console.error('Floaty: Failed to show tasks dialog:', error);
      this.showNotification('Failed to extract tasks: ' + error.message, 'error');
    }
  }

  createTasksDialog(tasks) {
    // Remove existing dialog
    const existingDialog = document.getElementById('floaty-tasks-dialog');
    if (existingDialog) {
      existingDialog.remove();
    }

    // Create dialog
    const dialog = document.createElement('div');
    dialog.id = 'floaty-tasks-dialog';
    dialog.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10002;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    const dialogContent = document.createElement('div');
    dialogContent.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 500px;
      width: 90vw;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      position: relative;
    `;

    const tasksList = tasks.map((task, index) => `
      <div style="
        padding: 12px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        margin-bottom: 8px;
        background: #f9fafb;
        display: flex;
        align-items: center;
        gap: 12px;
      ">
        <input type="checkbox" 
               id="task-${index}" 
               checked 
               style="width: 18px; height: 18px; cursor: pointer;">
        <label for="task-${index}" style="
          flex: 1;
          font-size: 14px;
          color: #374151;
          cursor: pointer;
          margin: 0;
        ">${typeof task === 'string' ? task : task.text}</label>
      </div>
    `).join('');

    dialogContent.innerHTML = `
      <div style="
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 16px;
        color: #111827;
      ">Extracted Tasks (${tasks.length})</div>
      
      <div style="margin-bottom: 20px; color: #6b7280; font-size: 14px;">
        Select the tasks you want to add to your task list:
      </div>
      
      <div style="margin-bottom: 24px;">
        ${tasksList}
      </div>
      
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button id="floaty-cancel-tasks" style="
          padding: 8px 16px;
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
        ">Cancel</button>
        <button id="floaty-add-selected-tasks" style="
          padding: 8px 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
        ">Add Selected Tasks</button>
      </div>
      
      <button id="floaty-close-tasks-dialog" style="
        position: absolute;
        top: 12px;
        right: 16px;
        background: none;
        border: none;
        font-size: 20px;
        color: #9ca3af;
        cursor: pointer;
      ">×</button>
    `;

    dialog.appendChild(dialogContent);
    document.body.appendChild(dialog);

    // Add event listeners
    const cancelBtn = document.getElementById('floaty-cancel-tasks');
    const addBtn = document.getElementById('floaty-add-selected-tasks');
    const closeBtn = document.getElementById('floaty-close-tasks-dialog');

    const closeDialog = () => {
      dialog.remove();
      this.hidePopup();
    };

    cancelBtn.addEventListener('click', closeDialog);
    closeBtn.addEventListener('click', closeDialog);

    addBtn.addEventListener('click', () => {
      const selectedTasks = [];
      tasks.forEach((task, index) => {
        const checkbox = document.getElementById(`task-${index}`);
        if (checkbox && checkbox.checked) {
          selectedTasks.push(typeof task === 'string' ? task : task.text);
        }
      });

      if (selectedTasks.length > 0) {
        // Check if extension context is still valid
        if (!this.isExtensionContextValid()) {
          this.showNotification('Extension context invalid. Please refresh the page.', 'error');
          closeDialog();
          return;
        }

        // Send tasks to popup to add to task list
        chrome.runtime.sendMessage({
          action: 'addTasksFromContent',
          tasks: selectedTasks,
          sourceText: this.selectedText,
          url: this.currentUrl,
          pageTitle: this.currentPageTitle
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Floaty: Runtime error adding tasks:', chrome.runtime.lastError);
            this.showNotification('Failed to add tasks: ' + chrome.runtime.lastError.message, 'error');
            return;
          }
          
          if (response && response.success) {
            this.showNotification(`Added ${selectedTasks.length} tasks to your list!`, 'success');
          } else {
            this.showNotification('Failed to add tasks', 'error');
          }
        });
      }

      closeDialog();
    });

    // Close dialog when clicking outside
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        closeDialog();
      }
    });
  }

  activateSpeechToText() {
    chrome.runtime.sendMessage({ action: 'speechToText' })
    this.showNotification('🎤 Speech-to-text activated', 'info')
  }

  activateNoteTaking() {
    chrome.runtime.sendMessage({ action: 'focusNote' })
    this.showNotification('📝 Note-taking activated', 'info')
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div')
    
    // Define background based on type
    let background
    switch (type) {
      case 'success':
        background = 'linear-gradient(135deg, #10b981, #059669)'
        break
      case 'error':
        background = 'linear-gradient(135deg, #ef4444, #dc2626)'
        break
      case 'warning':
        background = 'linear-gradient(135deg, #f59e0b, #d97706)'
        break
      default:
        background = 'linear-gradient(135deg, #3b82f6, #2563eb)'
    }
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${background};
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      z-index: 10001;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      animation: floatySlideIn 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `
    notification.textContent = message
    document.body.appendChild(notification)

    // Remove after 2 seconds
    setTimeout(() => {
      notification.style.animation = 'floatySlideOut 0.3s ease'
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification)
        }
      }, 300)
    }, 2000)
  }

  // Restore highlights from storage on page load (robust)
  restoreHighlightsOnLoad() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.restoreHighlightsOnLoad());
      return;
    }
    chrome.runtime.sendMessage({ action: 'getHighlightsForPage', url: this.currentUrl }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Floaty][CS] Error loading highlights for page:', chrome.runtime.lastError);
        return;
      }
      if (response && response.success && Array.isArray(response.highlights)) {
        console.log('[Floaty][CS] Restoring highlights:', response.highlights);
        response.highlights.forEach(h => this.restoreHighlightFromStorage(h));
      }
    });
  }

  // Restore a highlight using XPath and offsets
  restoreHighlightFromStorage(highlight) {
    if (!highlight.startXPath || !highlight.endXPath) {
      console.warn('[Floaty][CS] Highlight missing XPath info:', highlight);
      return;
    }
    const startNode = this.getNodeByXPath(highlight.startXPath);
    const endNode = this.getNodeByXPath(highlight.endXPath);
    console.log('[Floaty][CS] Restoring highlight:', highlight, startNode, endNode);
    if (!startNode || !endNode) {
      console.error('[Floaty][CS] Could not find start or end node for highlight:', highlight);
      return;
    }
    // Log node values and offsets
    console.log('[Floaty][CS] Start node value:', startNode.nodeValue, 'Start offset:', highlight.startOffset);
    console.log('[Floaty][CS] End node value:', endNode.nodeValue, 'End offset:', highlight.endOffset);
    // Check offset validity
    if (startNode.nodeType === Node.TEXT_NODE && (highlight.startOffset < 0 || highlight.startOffset > startNode.nodeValue.length)) {
      console.error('[Floaty][CS] Start offset out of range:', highlight.startOffset, 'Node length:', startNode.nodeValue.length);
      return;
    }
    if (endNode.nodeType === Node.TEXT_NODE && (highlight.endOffset < 0 || highlight.endOffset > endNode.nodeValue.length)) {
      console.error('[Floaty][CS] End offset out of range:', highlight.endOffset, 'Node length:', endNode.nodeValue.length);
      return;
    }
    try {
      const range = document.createRange();
      range.setStart(startNode, highlight.startOffset);
      range.setEnd(endNode, highlight.endOffset);
      const span = document.createElement('span');
      span.className = 'floaty-highlight';
      span.style.backgroundColor = '#fff3cd';
      span.style.borderBottom = '2px solid #ffc107';
      span.style.padding = '2px 0';
      range.surroundContents(span);
      console.log('[Floaty][CS] Highlight restored successfully.');
    } catch (e) {
      console.error('[Floaty][CS] Failed to restore highlight:', e, highlight);
    }
  }
}

// Initialize Floaty content script
console.log('Floaty content script loading...')

// Immediate test to see if script is running
console.log('Floaty: Script loaded on:', window.location.href)
console.log('Floaty: Chrome API available:', typeof chrome !== 'undefined')
console.log('Floaty: Chrome runtime available:', typeof chrome !== 'undefined' && chrome.runtime)

// Test background script connection immediately
if (typeof chrome !== 'undefined' && chrome.runtime) {
  setTimeout(() => {
    console.log('Floaty: Testing background connection...')
    chrome.runtime.sendMessage({action: 'test'}, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Floaty: Background connection failed:', chrome.runtime.lastError)
      } else if (response && response.success) {
        console.log('Floaty: Background connection successful:', response)
      } else {
        console.log('Floaty: Background connection failed - no response')
      }
    })
  }, 1000)
}

new FloatyContentScript() 