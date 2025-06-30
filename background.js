import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory
} from '@google/generative-ai';

let currentIds = null;
let generationInProgress = false;

// Gemini model variables
let genAI = null;
let model = null;
let generationConfig = {
  temperature: 1
};

// Initialize Gemini model
function initModel(apiKey) {
  if (!apiKey) {
    throw new Error('API key required');
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
      model: 'gemini-2.5-flash',
      safetySettings,
      generationConfig
    });
    return model;
  } catch (error) {
    throw new Error('Invalid API key');
  }
}

// Send the prompt to the model and return the response
async function runPrompt(prompt) {
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (e) {
    console.log('Prompt failed');
    console.error(e);
    console.log('Prompt:', prompt);
    
    if (e.toString().includes('API key not valid') || 
        e.toString().includes('API_KEY_INVALID')) {
      throw new Error('Invalid API Key, please provide a valid key');
    }
    
    throw e;
  }
}

// Fetch transcript from echo360
async function fetchTranscript(lessonId, mediaId, bearerToken) {
  const url = buildEcho360URL(lessonId, mediaId);
  console.log('Fetching transcript from URL:', url);
  
  const headers = {
    'Authorization': `Bearer ${bearerToken}`,
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    'Referer': `https://echo360.net.au/lesson/${lessonId}_classroom`,
  };

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: headers
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const text = await response.text();
    return text;
  } catch (error) {
    console.error('Error fetching transcript:', error);
    throw error;
  }
}

function buildEcho360URL(lessonId, mediaId) {
  const baseURL = 'https://echo360.net.au/api/ui/echoplayer/lessons/';
  return `${baseURL}${lessonId}/medias/${mediaId}/transcript-file?format=text`;
}

// Main generation function that runs in background
async function generateSummary(echoPlayerData, bearerToken, apiKey) {
  try {
    generationInProgress = true;
    
    // Store generation status
    await chrome.storage.local.set({
      generationStatus: 'fetching_transcript',
      generationError: null
    });
    
    // Fetch transcript
    const transcript = await fetchTranscript(echoPlayerData.lessonId, echoPlayerData.mediaId, bearerToken);
    
    await chrome.storage.local.set({
      generationStatus: 'generating_summary'
    });
    
    // Initialize model and generate summary
    initModel(apiKey);
    const fullPrompt = "You are a professional summarizer. Your task is to produce a clear, structured, and comprehensive summary of the provided academic lecture transcript. Follow these specific guidelines: 1. The summary must be detailed and in-depth, yet concise and easy to understand. 2. Clearly convey all key concepts, arguments, and examples presented in the lecture. 3. Strictly adhere to the content of the transcript. Do not add interpretations, assumptions, or external information. 4.Present the summary using CommonMark Spec markdown syntax, structured in a note-taking format: - Use headings (#, ##) to separate major topics or sections. - Use bullet points (-) for supporting details or subpoints. - Use bold or italics to highlight key terms or concepts. 5. Return only raw markdown text, without wrapping it in code blocks or including any non-markdown output, and without including any content other than the summary itself. Please follow these instructions for the following text:" + transcript;
    const aiResponse = await runPrompt(fullPrompt);
    
    // Store the response
    await chrome.storage.local.set({
      lecture_summary: aiResponse,
      generationStatus: 'completed',
      generationError: null
    });
    
    // Create a new tab with the response page
    chrome.tabs.create({
      url: chrome.runtime.getURL('response.html')
    });
    
    generationInProgress = false;
    return aiResponse;
    
  } catch (error) {
    console.error('Error in generateSummary:', error);
    generationInProgress = false;
    
    await chrome.storage.local.set({
      generationStatus: 'error',
      generationError: error.message || error.toString()
    });
    
    throw error;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background script received message:', message);
  
  if (message.type === 'ECHO360_IDS') {
    console.log('Updating currentIds:', message.data);
    currentIds = message.data;
  } else if (message.type === 'GENERATE_SUMMARY') {
    // Handle summary generation request
    console.log('Starting background generation...');
    
    generateSummary(message.echoPlayerData, message.bearerToken, message.apiKey)
      .then(response => {
        console.log('Generation completed successfully');
      })
      .catch(error => {
        console.error('Generation failed:', error);
      });
    
    // Send immediate response to indicate we received the request
    sendResponse({ status: 'started' });
  } else if (message.type === 'GET_GENERATION_STATUS') {
    // Return current generation status
    chrome.storage.local.get(['generationStatus', 'generationError']).then(result => {
      sendResponse({
        status: result.generationStatus || 'idle',
        error: result.generationError || null,
        inProgress: generationInProgress
      });
    });
    return true; // Keep message channel open for async response
  }
});

console.log('Background script initialized');
