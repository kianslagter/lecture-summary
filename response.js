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

document.addEventListener('DOMContentLoaded', () => {
  // Store the original markdown
  let originalMarkdown = '';
  let response = '';
  
  // Get the response from localStorage instead of URL parameter
  response = localStorage.getItem('lecture_summary') || '';
  
  if (response) {
    originalMarkdown = response;
    const summaryContent = document.getElementById('summary-content');
    
    // Initialize Showdown converter
    const converter = new showdown.Converter();
    
    // Convert markdown to HTML
    const html = converter.makeHtml(response);
    
    // Set the HTML content
    summaryContent.innerHTML = html;
  }

  // Copy functionality
  const copyMarkdownBtn = document.getElementById('copy-markdown');
  const copyRawBtn = document.getElementById('copy-raw');
  const copyMarkdownSuccess = document.getElementById('copy-markdown-success');
  const copyRawSuccess = document.getElementById('copy-raw-success');
  const summaryContent = document.getElementById('summary-content');
  
  // Handle Copy Raw
  copyRawBtn.addEventListener('click', () => {
    const strippedText = stripMarkdown(response);
    navigator.clipboard.writeText(strippedText).then(() => {
      copyRawSuccess.classList.add('show');
      setTimeout(() => {
        copyRawSuccess.classList.remove('show');
      }, 2000);
    });
  });
  
  // Handle Copy Markdown
  copyMarkdownBtn.addEventListener('click', () => {
    // Remove any markdown prefix if present
    const markdownText = response.replace(/^markdown\s*:\s*/i, '');
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
});