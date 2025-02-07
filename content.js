function findEchoPlayerProps() {
  console.log('Looking for Echo Player props...');
  
  // Access the existing console messages
  const consoleEntries = [];
  const originalConsole = window.console;
  const handler = {
    get: function(target, property) {
      const originalMethod = target[property];
      return function(...args) {
        consoleEntries.push({method: property, arguments: args});
        return originalMethod.apply(target, args);
      };
    }
  };
  
  window.console = new Proxy(originalConsole, handler);
  
  // Look through existing console entries
  const propsEntry = consoleEntries.find(entry => 
    entry.arguments && 
    entry.arguments[0] === 'EchoPlayerV2Full props' && 
    entry.arguments[1] && 
    typeof entry.arguments[1] === 'object'
  );
  
  // Restore original console
  window.console = originalConsole;
  
  const props = propsEntry ? propsEntry.arguments[1] : null;
  console.log('Found props:', props ? 'Yes' : 'No');
  
  if (props) {
    const lessonId = props.context?.lessonId;
    const mediaId = props.video?.mediaId;
    console.log('Found IDs:', { lessonId, mediaId });
    
    if (lessonId && mediaId) {
      console.log('Sending IDs to background script');
      chrome.runtime.sendMessage({
        type: 'ECHO360_IDS',
        data: { lessonId, mediaId }
      });
      return { lessonId, mediaId };
    }
  }
  return null;
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'findEchoPlayerProps') {
    const result = findEchoPlayerProps();
    sendResponse(result);
  } else if (request.action === 'getAuthToken') {
    const token = localStorage.getItem('authn-jwt');
    sendResponse({ token });
  }
  return true; // Keep the message channel open for async response
}); 