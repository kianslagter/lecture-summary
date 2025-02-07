import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory
} from '../node_modules/@google/generative-ai/dist/index.mjs';

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

let genAI = null;
let model = null;
let generationConfig = {
  temperature: 1
};

const inputPrompt = document.body.querySelector('#input-prompt');
const buttonPrompt = document.body.querySelector('#button-prompt');
const elementResponse = document.body.querySelector('#response');
const elementLoading = document.body.querySelector('#loading');
const elementError = document.body.querySelector('#error');
const apiKeyInput = document.body.querySelector('#api-key');
const saveApiKeyButton = document.body.querySelector('#save-api-key');

const apiKeyToggle = document.body.querySelector('#api-key-toggle');
const apiKeySection = document.body.querySelector('.api-key-section');

const lessonIdInput = document.body.querySelector('#lesson-id');
const mediaIdInput = document.body.querySelector('#media-id');
const fetchTranscriptButton = document.body.querySelector('#fetch-transcript');

// Set initial text content
apiKeyToggle.textContent = apiKeySection.classList.contains('collapsed') 
  ? '⚙️ Show API Settings' 
  : '⚙️ Hide API Settings';

apiKeyToggle.addEventListener('click', () => {
  apiKeySection.classList.toggle('collapsed');
  apiKeyToggle.textContent = apiKeySection.classList.contains('collapsed') 
    ? '⚙️ Show API Settings' 
    : '⚙️ Hide API Settings';
});

// Load saved API key on startup
document.addEventListener('DOMContentLoaded', () => {
  const savedApiKey = localStorage.getItem('gemini_api_key');
  if (savedApiKey) {
    apiKeyInput.value = savedApiKey;
    initModel(generationConfig);
    buttonPrompt.disabled = false;
  }
});

// Save API key
saveApiKeyButton.addEventListener('click', () => {
  const apiKey = apiKeyInput.value.trim();
  if (apiKey) {
    localStorage.setItem('gemini_api_key', apiKey);
    initModel(generationConfig);
    buttonPrompt.disabled = false;
  } else {
    elementError.textContent = 'Please enter a valid API key';
    elementError.hidden = false;
  }
});

function initModel(generationConfig) {
  const apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey) {
    elementError.textContent = 'Please save your API key first';
    elementError.hidden = false;
    return null;
  }

  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_NONE
    }
  ];
  
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
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

async function runPrompt(prompt) {
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (e) {
    console.log('Prompt failed');
    console.error(e);
    console.log('Prompt:', prompt);
    throw e;
  }
}

inputPrompt.addEventListener('input', () => {
  if (inputPrompt.value.trim()) {
    buttonPrompt.removeAttribute('disabled');
  } else {
    buttonPrompt.setAttribute('disabled', '');
  }
});

buttonPrompt.addEventListener('click', async () => {
  const prompt = inputPrompt.value.trim();
  showLoading();
  try {
    initModel(generationConfig);
    const response = await runPrompt(prompt, generationConfig);
    showResponse(response);
  } catch (e) {
    showError(e);
  }
});

// Update the fetch transcript button event listener
fetchTranscriptButton.addEventListener('click', async () => {
  try {
    console.log('Fetch transcript button clicked');
    
    // Get current tab to check if we're on Echo360
    console.log('Querying current tab...');
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('Current tabs:', tabs);
    
    if (!tabs || tabs.length === 0) {
      console.error('No active tab found');
      showError('Could not access current tab');
      return;
    }
    
    const tab = tabs[0];
    console.log('Current tab:', tab);
    
    if (!tab.url) {
      console.error('Tab URL is undefined');
      showError('Could not access tab URL');
      return;
    }

    if (!tab.url.includes('echo360.net.au') && !tab.url.includes('myuni.adelaide.edu.au')) {
      console.log('Not on Echo360 page. Current URL:', tab.url);
      showError('Please navigate to an Echo360 lecture page first');
      return;
    }

    showLoading();
    
    // Send message to content script to find Echo Player props
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'findEchoPlayerData' });
    
    if (!response) {
      showError('Could not find Echo360 player on this page. Please make sure you are on a lecture page.');
      return;
    }

    console.log('Getting bearer token...');
    const bearerToken = await getBearerToken();
    console.log('Bearer token retrieved:', bearerToken ? 'Yes' : 'No');

    console.log('Fetching transcript with:', {
      lessonId: response.lessonId,
      mediaId: response.mediaId,
      bearerToken: bearerToken ? 'Present' : 'Missing'
    });

    const transcript = await fetchTranscript(response.lessonId, response.mediaId, bearerToken);
    console.log('Transcript received, length:', transcript?.length);
    inputPrompt.value = transcript;
    hide(elementLoading);
  } catch (error) {
    console.error('Fetch transcript error:', error);
    showError(error.message);
  }
});

// Add debug logs to getBearerToken
async function getBearerToken() {
  try {
    console.log('Getting token from localStorage...');
    // Send message to content script to get localStorage token
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || !tabs.length) {
      throw new Error('No active tab found');
    }

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
    console.error('Error getting bearer token:', error);
    throw error;
  }
}

// Add debug logs to fetchTranscript
async function fetchTranscript(lessonId, mediaId, bearerToken) {
  const url = buildEcho360URL(lessonId, mediaId);
  console.log('Fetching transcript from URL:', url);
  
  const headers = {
    'Authorization': `Bearer ${bearerToken}`,
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    'Referer': `https://echo360.net.au/lesson/${lessonId}_classroom`,
  };
  console.log('Request headers:', headers);

  try {
    console.log('Making fetch request...');
    const response = await fetch(url, {
      method: 'GET',
      headers: headers
    });
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const text = await response.text();
    console.log('Response text length:', text.length);
    return text;
  } catch (error) {
    console.error('Error fetching transcript:', error);
    throw error;
  }
}

function showLoading() {
  hide(elementResponse);
  hide(elementError);
  show(elementLoading);
}

function showResponse(response) {
  hide(elementLoading);
  show(elementResponse);
  // Make sure to preserve line breaks in the response
  elementResponse.textContent = '';
  const paragraphs = response.split(/\r?\n/);
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    if (paragraph) {
      elementResponse.appendChild(document.createTextNode(paragraph));
    }
    // Don't add a new line after the final paragraph
    if (i < paragraphs.length - 1) {
      elementResponse.appendChild(document.createElement('BR'));
    }
  }
}

function showError(error) {
  show(elementError);
  hide(elementResponse);
  hide(elementLoading);
  elementError.textContent = error;
}

function show(element) {
  element.removeAttribute('hidden');
}

function hide(element) {
  element.setAttribute('hidden', '');
}

function buildEcho360URL(lessonId, mediaId) {
  const baseURL = 'https://echo360.net.au/api/ui/echoplayer/lessons/';
  return `${baseURL}${lessonId}/medias/${mediaId}/transcript-file?format=text`;
}
