import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory
} from '@google/generative-ai';

// Important! Do not expose your API in your extension code. You have to
// options:
//
// 1. Let users provide their own API key.
// 2. Manage API keys in your own server and proxy all calls to the Gemini
// API through your own server, where you can implement additional security
// measures such as authentification.
//
// It is only OK to put your API key into this file if you're the only
// user of your extension or for testing.
const apiKey = '';

// Gemini model variables
let genAI = null;
let model = null;
let generationConfig = {
  temperature: 1
};

// Element references for ui componenets
const inputPrompt = document.body.querySelector('#input-prompt');
const buttonPrompt = document.body.querySelector('#button-prompt');
const elementResponse = document.body.querySelector('#response');
const elementLoading = document.body.querySelector('#loading');
const elementError = document.body.querySelector('#error');
const apiKeyInput = document.body.querySelector('#api-key');
const saveApiKeyButton = document.body.querySelector('#save-api-key');
const apiKeyToggle = document.body.querySelector('#api-key-toggle');
const apiKeySection = document.body.querySelector('.api-key-section');
const elementApiKeyMessage = document.body.querySelector('#api-key-message');
const elementGuide = document.body.querySelector('#guide');
const viewSummariesButton = document.body.querySelector('#view-summaries');

// Initalise API key section toggle based on state
apiKeyToggle.textContent = apiKeySection.classList.contains('collapsed') 
  ? '⚙️ Show API Settings' 
  : '⚙️ Hide API Settings';

apiKeyToggle.addEventListener('click', () => {
  apiKeySection.classList.toggle('collapsed');
  apiKeyToggle.textContent = apiKeySection.classList.contains('collapsed') 
    ? '⚙️ Show API Settings' 
    : '⚙️ Hide API Settings';
});

// Load saved API key on startup and initalise exentension
document.addEventListener('DOMContentLoaded', async () => {
  const savedApiKey = localStorage.getItem('gemini_api_key');
  if (savedApiKey) {
    apiKeyInput.value = savedApiKey;
    initModel(generationConfig);
    elementApiKeyMessage.hidden = true;
  }
  updateRunButtonState();
  updateGuideVisibility();
  
  // Check if there's an ongoing generation
  try {
    const statusResponse = await chrome.runtime.sendMessage({
      type: 'GET_GENERATION_STATUS'
    });
    
    if (statusResponse.inProgress || 
        statusResponse.status === 'fetching_transcript' || 
        statusResponse.status === 'generating_summary') {
      // Resume status polling and show background processing
      startStatusPolling();
      showBackgroundProcessing();
      
      if (statusResponse.status === 'fetching_transcript') {
        updateBackgroundStatus('Fetching transcript...');
      } else if (statusResponse.status === 'generating_summary') {
        updateBackgroundStatus('Generating summary...');
      }
    }
  } catch (error) {
    console.log('No background generation in progress');
  }
});

// Handle api key saving and validation
saveApiKeyButton.addEventListener('click', () => {
  const apiKey = apiKeyInput.value.trim();
  if (apiKey) {
    localStorage.setItem('gemini_api_key', apiKey);
    initModel(generationConfig);
    elementApiKeyMessage.hidden = true;
    updateRunButtonState();
    
    // Show success message
    elementError.textContent = 'API key updated successfully!';
    elementError.hidden = false;
    
    // Hide the success message after a few seconds
    setTimeout(() => {
      elementError.hidden = true;
    }, 3000);
  } else {
    elementError.textContent = 'API key required, you can create one here: https://aistudio.google.com/app/apikey';
    elementError.hidden = false;
  }
});

// Handle opening the response page to view previously generated summaries
viewSummariesButton.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('response.html') });
});

// Manage the Run button state based on whether an API key exists
function updateRunButtonState() {
  const hasApiKey = !!localStorage.getItem('gemini_api_key');
  buttonPrompt.disabled = !(hasApiKey);
  
  if (!hasApiKey) {
    showError('API key is required');
  } else {
    elementError.hidden = true;
  }
}

// Gemini model initialization
function initModel(generationConfig) {
  const apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey) {
    elementError.textContent = 'API key required, you can create one here: https://aistudio.google.com/app/apikey';
    elementError.hidden = false;
    return null;
  }

  // configure model safety settings
  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_NONE
    }
  ];
  
  // Using 2.0 flash currently, could add option to be changed to other models?
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-preview-05-20',
      safetySettings,
      generationConfig
    });
    elementError.hidden = true;
    return model;
  } catch (error) {
    elementError.textContent = 'Invalid API key';
    elementError.hidden = false;
    return null;
  }
}



// Enable the prompt button based on input content
inputPrompt.addEventListener('input', () => {
  if (inputPrompt.value.trim()) {
    buttonPrompt.removeAttribute('disabled');
  } else {
    buttonPrompt.setAttribute('disabled', '');
  }
});

// Main functionality of processing lecture content
buttonPrompt.addEventListener('click', async () => {
  const prompt = inputPrompt.value.trim();
  showLoading();
  hide(elementGuide);

  try {
    // Get current tab to check if we're on Echo360
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tabs || tabs.length === 0) {
      throw new Error('No active tab found');
    }
    
    const tab = tabs[0];
    
    if (!tab.url.includes('echo360.net.au') && !tab.url.includes('myuni.adelaide.edu.au')) {
      throw new Error('Please navigate to an Echo360 lecture page first');
    }
    
    // Send message to content script to find Echo Player props
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'findEchoPlayerData' });
      
      if (!response) {
        throw new Error('Could not find Echo360 player on this page. Please make sure you are on a lecture page.');
      }
      
      const bearerToken = await getBearerToken();
      const apiKey = localStorage.getItem('gemini_api_key');
      
      if (!apiKey) {
        throw new Error('API key required');
      }
      
      // Send generation request to background script
      const backgroundResponse = await chrome.runtime.sendMessage({
        type: 'GENERATE_SUMMARY',
        echoPlayerData: response,
        bearerToken: bearerToken,
        apiKey: apiKey
      });
      
      if (backgroundResponse.status === 'started') {
        // Start polling for status updates
        startStatusPolling();
        showBackgroundProcessing();
      } else {
        throw new Error('Failed to start background generation');
      }
      
    } catch (error) {
      if (error.message && error.message.includes("Receiving end does not exist")) {
        throw new Error('Could not connect, please check your connection or refresh the page');
      }
      throw error;
    }
  } catch (e) {
    showError(e.message || e);
  }
});

// Retrieve authentication token from Echo360 using the content script
async function getBearerToken() {
  try {
    console.log('Getting token from localStorage...');
    // Send message to content script to get localStorage token
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || !tabs.length) {
      throw new Error('No active tab found');
    }

    try {
      const response = await chrome.tabs.sendMessage(tabs[0].id, { 
        action: 'getAuthToken'
      });
      
      console.log('Token retrieved:', response?.token ? 'Yes' : 'No');
      
      if (!response || !response.token) {
        console.error('No token found');
        throw new Error('No Echo360 session found. Please log in to Echo360 first.');
      }
      
      return response.token;
    } catch (error) {
      if (error.message && error.message.includes("Receiving end does not exist")) {
        throw new Error('Could not connect, please check your connection or refresh the page');
      }
      throw error;
    }
  } catch (error) {
    console.error('Error getting bearer token:', error);
    throw error;
  }
}



// ui state management function
function showLoading() {
  hide(elementResponse);
  hide(elementError);
  show(elementLoading);
}

// Display generated summary and open in new tab
function showResponse(response) {
  hide(elementLoading);
  show(elementResponse);
  console.log(response);
  
  // Store the response in localStorage
  localStorage.setItem('lecture_summary', response);
  
  // Create a new tab with the response page
  chrome.tabs.create({
    url: chrome.runtime.getURL('response.html')
  });
  
  // Show success message with link
  elementResponse.innerHTML = 'Response Generated Successfully! <a href="#" id="view-response">View here</a>';
  
  // Add click handler for the link
  document.getElementById('view-response').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({
      url: chrome.runtime.getURL('response.html')
    });
  });
}

// Show background processing status
function showBackgroundProcessing() {
  hide(elementLoading);
  show(elementResponse);
  elementResponse.innerHTML = `
    <div style="text-align: center;">
      <div class="background-status">
        <span class="blink">Processing in background...</span>
        <br><small>You can close this popup or switch tabs. The summary will open automatically when ready.</small>
      </div>
    </div>
  `;
}

// Start polling for generation status
function startStatusPolling() {
  const pollInterval = setInterval(async () => {
    try {
      const statusResponse = await chrome.runtime.sendMessage({
        type: 'GET_GENERATION_STATUS'
      });
      
      if (statusResponse.status === 'completed') {
        clearInterval(pollInterval);
        // Get the generated summary from storage
        const result = await chrome.storage.local.get(['lecture_summary']);
        if (result.lecture_summary) {
          showResponse(result.lecture_summary);
        }
      } else if (statusResponse.status === 'error') {
        clearInterval(pollInterval);
        showError(statusResponse.error || 'Generation failed');
      } else if (statusResponse.status === 'fetching_transcript') {
        updateBackgroundStatus('Fetching transcript...');
      } else if (statusResponse.status === 'generating_summary') {
        updateBackgroundStatus('Generating summary...');
      }
    } catch (error) {
      console.error('Error polling status:', error);
      // Continue polling in case of temporary errors
    }
  }, 2000); // Poll every 2 seconds
}

// Update background processing status message
function updateBackgroundStatus(message) {
  const statusElement = document.querySelector('.background-status');
  if (statusElement) {
    statusElement.innerHTML = `
      <span class="blink">${message}</span>
      <br><small>You can close this popup or switch tabs. The summary will open automatically when ready.</small>
    `;
  }
}

// SHows error message to user
function showError(error) {
  show(elementError);
  hide(elementResponse);
  hide(elementLoading);
  elementError.textContent = error;
}


// Helper functions to mange element visibility
function show(element) {
  element.removeAttribute('hidden');
}

function hide(element) {
  element.setAttribute('hidden', '');
}



// Update the guide based on current page and API key status
async function updateGuideVisibility() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const guideElement = document.getElementById('guide');
  const navigateMessage = document.getElementById('guide-navigate');
  const readyMessage = document.getElementById('guide-ready');
  
  const hasApiKey = !!localStorage.getItem('gemini_api_key');

  if (!hasApiKey) {
    hide(guideElement);
    return;
  }

  if (!tabs || tabs.length === 0) {
    show(guideElement);
    show(navigateMessage);
    hide(readyMessage);
    return;
  }
  
  // Show guide if user not on Echo360
  const tab = tabs[0];
  if (!tab.url.includes('echo360.net.au')) {
    show(guideElement);
    show(navigateMessage);
    hide(readyMessage);
  } else {
    show(guideElement);
    hide(navigateMessage);
    show(readyMessage);
  }
}

chrome.tabs.onActivated.addListener(() => {
  updateGuideVisibility();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    updateGuideVisibility();
  }
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
