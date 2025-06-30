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

// Function to get a title from the content
function getTitle(text) {
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      return trimmed.substring(2);
    }
    if (trimmed.startsWith('## ')) {
      return trimmed.substring(3);
    }
    if (trimmed.length > 0 && !trimmed.startsWith('#')) {
      return trimmed.length > 50 ? trimmed.substring(0, 50) + '...' : trimmed;
    }
  }
  return 'Untitled Summary';
}

// Function to save a response to history
function saveToHistory(content) {
  if (!content || content.trim() === '') return;
  
  const history = JSON.parse(localStorage.getItem('lecture_history') || '[]');
  const newEntry = {
    id: Date.now().toString(),
    content: content,
    title: getTitle(content),
    preview: getPreview(content),
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
        loadSummary(selectedItem.content);
        
        // Update active state
        historyList.querySelectorAll('.history-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
      }
    });
  });
}

// Function to load a summary into the main content area
function loadSummary(content) {
  const summaryContent = document.getElementById('summary-content');
  const converter = new showdown.Converter();
  const html = converter.makeHtml(content);
  summaryContent.innerHTML = html;
  
  // Store the current content for copy functionality
  window.currentSummaryContent = content;
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
    // Save to history if it's a new response
    const history = loadHistory();
    const isNewResponse = !history.some(item => item.content === response);
    
    if (isNewResponse) {
      saveToHistory(response);
    }
    
    // Load the summary
    loadSummary(response);
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