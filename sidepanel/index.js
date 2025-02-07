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


// Add new element reference at the top with other element declarations
const elementApiKeyMessage = document.body.querySelector('#api-key-message');
const elementGuide = document.body.querySelector('#guide');

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
    elementApiKeyMessage.hidden = true;
  }
  updateRunButtonState();
  updateGuideVisibility();
});

// Save API key
saveApiKeyButton.addEventListener('click', () => {
  const apiKey = apiKeyInput.value.trim();
  if (apiKey) {
    localStorage.setItem('gemini_api_key', apiKey);
    initModel(generationConfig);
    elementApiKeyMessage.hidden = true;
    updateRunButtonState();
  } else {
    elementError.textContent = 'API key required, you can create one here: https://aistudio.google.com/app/apikey';
    elementError.hidden = false;
  }
});

// Add new function to check and update run button state
function updateRunButtonState() {
  const hasApiKey = !!localStorage.getItem('gemini_api_key');
  buttonPrompt.disabled = !(hasApiKey);
  
  if (!hasApiKey) {
    showError('API key is required');
  } else {
    elementError.hidden = true;
  }
}

function initModel(generationConfig) {
  const apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey) {
    elementError.textContent = 'API key required, you can create one here: https://aistudio.google.com/app/apikey';
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
      model: 'gemini-2.0-flash',
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
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'findEchoPlayerData' });
    
    if (!response) {
      throw new Error('Could not find Echo360 player on this page. Please make sure you are on a lecture page.');
    }
    
    const bearerToken = await getBearerToken();
    const transcript = await fetchTranscript(response.lessonId, response.mediaId, bearerToken);
    
    // Update the prompt with the transcript
    const fullPrompt = "As a professional summarizer, create a concise and comprehensive summary of the provided text, which is an audio transcript of an academic lecture, while adhering to these guidelines: 1. Craft a summary that is detailed, thorough, in-depth, and complex, while maintaining clarity and conciseness. 2. Incorporate all main ideas and all initial information provided and ensuring ease of understanding. 3. Rely strictly on the provided text, without including external information. 4. Format the summary in sections for a note-taking form for easy understanding, please use double asterisks like '**this**' for bold text, and use single asteriks '* this' for dot points. By following these optimized prompts, you will generate an effective summary that encapsulates the essence of the given text in a clear, concise, and reader-friendly manner. Please follow these instructions for the following text:" + transcript;

    // Initialize model and run the prompt
    initModel(generationConfig);
    const aiResponse = await runPrompt(fullPrompt, generationConfig);
    showResponse(aiResponse);
  } catch (e) {
    showError(e.message || e);
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
  console.log(response);
  
  // Create a new tab with the response
  const encodedResponse = encodeURIComponent(response);
  chrome.tabs.create({
    url: chrome.runtime.getURL(`response.html?response=${encodedResponse}`)
  });
  
  // Show success message with link
  elementResponse.innerHTML = 'Response Generated Successfully! <a href="#" id="view-response">View here</a>';
  
  // Add click handler for the link
  document.getElementById('view-response').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({
      url: chrome.runtime.getURL(`response.html?response=${encodedResponse}`)
    });
  });
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

async function updateGuideVisibility() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const guideElement = document.getElementById('guide');
  const navigateMessage = document.getElementById('guide-navigate');
  const readyMessage = document.getElementById('guide-ready');
  
  if (!tabs || tabs.length === 0) {
    show(guideElement);
    show(navigateMessage);
    hide(readyMessage);
    return;
  }
  
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

// Add this new event listener
chrome.tabs.onActivated.addListener(() => {
  updateGuideVisibility();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    updateGuideVisibility();
  }
});
