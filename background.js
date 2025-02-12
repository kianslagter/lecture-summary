let currentIds = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background script received message:', message);
  if (message.type === 'ECHO360_IDS') {
    console.log('Updating currentIds:', message.data);
    currentIds = message.data;
  }
});

console.log('Background script initialized');
