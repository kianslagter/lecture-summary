function findEchoPlayerData() {
  return new Promise((resolve, reject) => {
    console.log('Looking for Echo Player props...');
    
    const extractMediaId = () => {
      // Try multiple methods to extract MediaID
      const video = document.querySelector('video[poster]');
      
      if (video) {
        const posterURL = video.getAttribute('poster');
        console.log('Full Poster URL:', posterURL);
        
        // Regex to extract MediaID without the /1
        const mediaIdMatch = posterURL.match(/\/([^/]+)\/[^/]+\/poster1\.jpg/);
        const mediaId = mediaIdMatch ? mediaIdMatch[1] : null;
        
        console.log('Found mediaId:', mediaId);
        
        // Extract LessonID from URL
        const lessonId = window.location.href.match(/echo360\.net\.au\/lesson\/([^/]+)/)?.[1];
        console.log('Found lessonId:', lessonId);
        
        if (lessonId && mediaId) {
          console.log('Sending IDs to background script');
          chrome.runtime.sendMessage({
            type: 'ECHO360_IDS',
            data: { lessonId, mediaId }
          });
          resolve({ lessonId, mediaId });
          return;
        }
      }
      
      // If no success, try again after a short delay
      setTimeout(extractMediaId, 2000);
    };
    
    // Initial attempt
    extractMediaId();
    
    // Timeout if no result after 10 seconds
    setTimeout(() => {
      console.log('Failed to extract media ID');
      resolve(null);
    }, 10000);
  });
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'findEchoPlayerData') {
    findEchoPlayerData().then(result => {
      sendResponse(result);
    });
    return true; // Keep the message channel open for async response
  } else if (request.action === 'getAuthToken') {
    const token = localStorage.getItem('authn-jwt');
    sendResponse({ token });
  }
});