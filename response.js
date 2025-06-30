// Function to strip markdown syntax
function stripMarkdown(text) {
  return text
    .replace(/#{1,6}\s/g, '') // Remove headers
    .replace(/\*\*/g, '')     // Remove bold
    .replace(/\*/g, '')       // Remove italics
    .replace(/`{3}.*?\n([\s\S]*?)`{3}/g, '$1') // Remove code blocks
    .replace(/`([^`]+)`/g, '$1') // Remove inline code
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Replace links with just text
    .replace(/^\s*[-+*]\s/gm, '') // Remove list markers
    .replace(/^\s*\d+\.\s/gm, ''); // Remove numbered list markers
}

// Function to get a preview of the content
function getPreview(text, maxLength = 100) {
  const stripped = stripMarkdown(text);
  return stripped.length > maxLength ? stripped.substring(0, maxLength) + '...' : stripped;
}

// Function to get the first line as title
function getFirstLineTitle(text) {
  const lines = text.split('\n');
  const firstLine = lines[0]?.trim() || '';
  // Remove all # symbols and any markdown formatting
  return firstLine.replace(/^#+\s*/, '').replace(/[*]/g, '').trim() || 'Untitled Summary';
}

// Function to ensure content has a title
function ensureContentHasTitle(content) {
  const lines = content.split('\n');
  const firstLine = lines[0]?.trim() || '';
  
  // If first line doesn't start with #, add a title
  if (!firstLine.startsWith('#')) {
    const title = getFirstLineTitle(content) || 'Lecture Summary';
    return `# ${title}\n\n${content}`;
  }
  
  // If first line starts with ## or more, convert to single #
  if (firstLine.startsWith('##')) {
    const titleText = firstLine.replace(/^#+\s*/, '').trim();
    lines[0] = `# ${titleText}`;
    return lines.join('\n');
  }
  
  return content;
}

// Function to update title in content
function updateTitleInContent(content, newTitle) {
  const lines = content.split('\n');
  const cleanTitle = newTitle.replace(/^#+\s*/, '').trim();
  
  if (lines[0]?.trim().startsWith('#')) {
    lines[0] = `# ${cleanTitle}`;
  } else {
    lines.unshift(`# ${cleanTitle}`);
  }
  
  return lines.join('\n');
}

// Function to save a response to history
function saveToHistory(content) {
  if (!content || content.trim() === '') return;
  
  const contentWithTitle = ensureContentHasTitle(content);
  const title = getFirstLineTitle(contentWithTitle);
  
  const history = JSON.parse(localStorage.getItem('lecture_history') || '[]');
  const newEntry = {
    id: Date.now().toString(),
    content: contentWithTitle,
    title: title,
    preview: getPreview(contentWithTitle),
    date: new Date().toISOString(),
    timestamp: Date.now()
  };
  
  // Add to beginning of array (most recent first)
  history.unshift(newEntry);
  
  // Keep only the last 50 entries
  if (history.length > 50) {
    history.splice(50);
  }
  
  localStorage.setItem('lecture_history', JSON.stringify(history));
  return newEntry;
}

// Function to load history from localStorage
function loadHistory() {
  return JSON.parse(localStorage.getItem('lecture_history') || '[]');
}

// Function to clear all history
function clearHistory() {
  localStorage.removeItem('lecture_history');
  renderHistory();
}

// Function to delete a specific history item
function deleteHistoryItem(id) {
  const history = loadHistory();
  const filteredHistory = history.filter(item => item.id !== id);
  localStorage.setItem('lecture_history', JSON.stringify(filteredHistory));
  renderHistory();
  
  // If we deleted the currently displayed item, clear the content
  if (window.currentHistoryId === id) {
    const summaryContent = document.getElementById('summary-content');
    summaryContent.innerHTML = '<p>Select a summary from the history to view it here.</p>';
    window.currentSummaryContent = '';
    window.currentHistoryId = null;
  }
}

// Function to update history item
function updateHistoryItem(id, newContent) {
  const history = loadHistory();
  const itemIndex = history.findIndex(item => item.id === id);
  
  if (itemIndex !== -1) {
    const contentWithTitle = ensureContentHasTitle(newContent);
    history[itemIndex] = {
      ...history[itemIndex],
      content: contentWithTitle,
      title: getFirstLineTitle(contentWithTitle),
      preview: getPreview(contentWithTitle)
    };
    
    localStorage.setItem('lecture_history', JSON.stringify(history));
    renderHistory();
    return history[itemIndex];
  }
  
  return null;
}

// Function to render history items
function renderHistory() {
  const historyList = document.getElementById('history-list');
  const history = loadHistory();
  
  if (history.length === 0) {
    historyList.innerHTML = `
      <div class="history-empty">
        <i class="material-icons">history</i>
        <p>No summaries yet</p>
        <p>Your lecture summaries will appear here</p>
      </div>
    `;
    return;
  }
  
  historyList.innerHTML = history.map(item => `
    <div class="history-item" data-id="${item.id}">
      <div class="history-item-title">${item.title}</div>
      <div class="history-item-date">${new Date(item.date).toLocaleDateString()} ${new Date(item.date).toLocaleTimeString()}</div>
      <div class="history-item-preview">${item.preview}</div>
    </div>
  `).join('');
  
  // Add click listeners to history items
  historyList.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      const history = loadHistory();
      const selectedItem = history.find(h => h.id === id);
      
      if (selectedItem) {
        loadSummary(selectedItem.content, selectedItem.id);
        
        // Update active state
        historyList.querySelectorAll('.history-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
      }
    });
  });
}

// Function to load a summary into the main content area
function loadSummary(content, historyId = null) {
  const contentWithTitle = ensureContentHasTitle(content);
  const summaryContent = document.getElementById('summary-content');
  const converter = new showdown.Converter();
  const html = converter.makeHtml(contentWithTitle);
  summaryContent.innerHTML = html;
  
  // Store the current content for copy functionality
  window.currentSummaryContent = contentWithTitle;
  window.currentHistoryId = historyId;
  
  // Add edit functionality to the first h1 in the summary content
  addEditFunctionalityToSummaryTitle();
}

// Function to add edit functionality to the summary title
function addEditFunctionalityToSummaryTitle() {
  const summaryContent = document.getElementById('summary-content');
  const titleElement = summaryContent.querySelector('h1');
  
  if (!titleElement) return;
  
  const originalTitle = titleElement.textContent;
  titleElement.innerHTML = `
    <span class="editable-title" id="summary-title">${originalTitle}</span>
    <button class="edit-title-btn" id="edit-summary-title-btn" type="button">
      <i class="material-icons">edit</i>
    </button>
  `;
  
  // Add edit functionality
  const editBtn = document.getElementById('edit-summary-title-btn');
  const titleSpan = document.getElementById('summary-title');
  
  editBtn.addEventListener('click', () => {
    const currentTitle = titleSpan.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentTitle;
    input.className = 'title-input';
    
    titleSpan.style.display = 'none';
    editBtn.style.display = 'none';
    titleSpan.parentNode.insertBefore(input, titleSpan);
    
    input.focus();
    input.select();
    
    function saveTitle() {
      // Check if input still exists to prevent double-execution error
      if (!input.parentNode) {
        return;
      }
      
      const newTitle = input.value.trim() || 'Untitled Summary';
      titleSpan.textContent = newTitle;
      titleSpan.style.display = 'inline';
      editBtn.style.display = 'inline-block';
      
      // Remove event listeners before removing the element
      input.removeEventListener('blur', saveTitle);
      input.removeEventListener('keypress', handleKeypress);
      input.remove();
      
      // Update the content and history
      if (window.currentSummaryContent) {
        const updatedContent = updateTitleInContent(window.currentSummaryContent, newTitle);
        window.currentSummaryContent = updatedContent;
        
        // Update in history if this is from history
        if (window.currentHistoryId) {
          updateHistoryItem(window.currentHistoryId, updatedContent);
        }
        
        // Re-render the summary with updated content (but preserve edit state)
        loadSummary(updatedContent, window.currentHistoryId);
      }
    }
    
    function handleKeypress(e) {
      if (e.key === 'Enter') {
        saveTitle();
      }
    }
    
    input.addEventListener('blur', saveTitle);
    input.addEventListener('keypress', handleKeypress);
  });
}

// Function to handle sidebar toggle
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('open');
}

document.addEventListener('DOMContentLoaded', () => {
  let response = '';
  
  // Get the response from localStorage
  response = localStorage.getItem('lecture_summary') || '';
  
  if (response) {
    const responseWithTitle = ensureContentHasTitle(response);
    
    // Save to history if it's a new response
    const history = loadHistory();
    const isNewResponse = !history.some(item => item.content === responseWithTitle);
    
    let historyId = null;
    if (isNewResponse) {
      const savedEntry = saveToHistory(responseWithTitle);
      historyId = savedEntry?.id;
    }
    
    // Load the summary
    loadSummary(responseWithTitle, historyId);
  }
  
  // Render history
  renderHistory();
  
  // Copy functionality
  const copyMarkdownBtn = document.getElementById('copy-markdown');
  const copyRawBtn = document.getElementById('copy-raw');
  const copyMarkdownSuccess = document.getElementById('copy-markdown-success');
  const copyRawSuccess = document.getElementById('copy-raw-success');
  
  // Handle Copy Raw
  copyRawBtn.addEventListener('click', () => {
    const content = window.currentSummaryContent || response;
    const strippedText = stripMarkdown(content);
    navigator.clipboard.writeText(strippedText).then(() => {
      copyRawSuccess.classList.add('show');
      setTimeout(() => {
        copyRawSuccess.classList.remove('show');
      }, 2000);
    });
  });
  
  // Handle Copy Markdown
  copyMarkdownBtn.addEventListener('click', () => {
    const content = window.currentSummaryContent || response;
    const markdownText = content.replace(/^markdown\s*:\s*/i, '');
    navigator.clipboard.writeText(markdownText).then(() => {
      copyMarkdownSuccess.classList.add('show');
      setTimeout(() => {
        copyMarkdownSuccess.classList.remove('show');
      }, 2000);
    });
  });

  // Theme handling
  const themeToggle = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('theme') || 'light';

  document.documentElement.setAttribute('data-theme', savedTheme);
  themeToggle.querySelector('.light-icon').style.display = savedTheme === 'dark' ? 'none' : 'inline-block';
  themeToggle.querySelector('.dark-icon').style.display = savedTheme === 'dark' ? 'inline-block' : 'none';

  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    themeToggle.querySelector('.light-icon').style.display = newTheme === 'dark' ? 'none' : 'inline-block';
    themeToggle.querySelector('.dark-icon').style.display = newTheme === 'dark' ? 'inline-block' : 'none';
  });
  
  // Sidebar toggle
  const sidebarToggle = document.getElementById('sidebar-toggle');
  sidebarToggle.addEventListener('click', toggleSidebar);
  
  // Clear history
  const clearHistoryBtn = document.getElementById('clear-history');
  clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all history? This action cannot be undone.')) {
      clearHistory();
    }
  });
  
  // Delete current entry
  const deleteEntryBtn = document.getElementById('delete-entry');
  deleteEntryBtn.addEventListener('click', () => {
    if (window.currentHistoryId) {
      const history = loadHistory();
      const currentItem = history.find(item => item.id === window.currentHistoryId);
      const itemTitle = currentItem ? currentItem.title : 'this entry';
      
      if (confirm(`Are you sure you want to delete "${itemTitle}"? This action cannot be undone.`)) {
        deleteHistoryItem(window.currentHistoryId);
      }
    } else {
      alert('No entry selected to delete. Please select an entry from the history first.');
    }
  });
  
  // Close sidebar when clicking outside on mobile
  document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    
    if (window.innerWidth <= 768 && 
        !sidebar.contains(e.target) && 
        !sidebarToggle.contains(e.target) && 
        sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
    }
  });
});