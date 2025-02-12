document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const response = urlParams.get('response');
  
  if (response) {
    const summaryContent = document.getElementById('summary-content');
    
    // Initialize Showdown converter
    const converter = new showdown.Converter();
    
    // Convert markdown to HTML
    const html = converter.makeHtml(response);
    
    // Set the HTML content
    summaryContent.innerHTML = html;
  }

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