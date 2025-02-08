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
}); 