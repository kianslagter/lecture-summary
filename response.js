document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const response = urlParams.get('response');
  
  if (response) {
    const summaryContent = document.getElementById('summary-content');
    const paragraphs = response.split(/\r?\n/);
    
    paragraphs.forEach(paragraph => {
      if (paragraph.trim()) {
        const p = document.createElement('p');
        
        // Handle double asterisks for bold text
        let text = paragraph;
        const boldPattern = /\*\*(.*?)\*\*/g;
        text = text.replace(boldPattern, '<strong>$1</strong>');
        
        // Handle single asterisk for bullet points
        if (text.trim().startsWith('*')) {
          const li = document.createElement('li');
          // Remove the asterisk and trim
          text = text.substring(1).trim();
          li.innerHTML = text;
          
          // Check if we need to create a new list or append to existing
          let ul = summaryContent.lastElementChild;
          if (!ul || ul.tagName !== 'UL') {
            ul = document.createElement('ul');
            summaryContent.appendChild(ul);
          }
          ul.appendChild(li);
        } else {
          p.innerHTML = text;
          summaryContent.appendChild(p);
        }
      }
    });
  }
}); 