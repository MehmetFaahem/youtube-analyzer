const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const puppeteer = require('puppeteer');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Ensure directories exist
const ensureDirectories = async () => {
  await fs.ensureDir('./uploads');
  await fs.ensureDir('./screenshots');
  await fs.ensureDir('./audio');
  await fs.ensureDir('./results');
  await fs.ensureDir('./public');
};

// In-memory storage for results (in production, use a database)
const results = new Map();

// YouTube URL validation
const isValidYouTubeUrl = (url) => {
  const youtubeRegex = /^(https?\:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
  return youtubeRegex.test(url);
};

// Puppeteer screenshot function
const takeScreenshot = async (url, screenshotPath) => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    // Navigate to YouTube URL
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for video player to load
    await page.waitForSelector('video', { timeout: 10000 });
    
    // Try to click play button and verify playback
    try {
      const playButton = await page.$('.ytp-large-play-button');
      if (playButton) {
        await playButton.click();
        await page.waitForTimeout(2000); // Wait for playback to start
      }
    } catch (e) {
      console.log('Could not click play button, video might autoplay');
    }
    
    // Take screenshot
    await page.screenshot({ path: screenshotPath, fullPage: false });
    
    return true;
  } finally {
    await browser.close();
  }
};

// Download and convert audio
const downloadAndConvertAudio = async (url, outputPath) => {
  return new Promise((resolve, reject) => {
    const audioStream = ytdl(url, { quality: 'highestaudio' });
    
    ffmpeg(audioStream)
      .audioFrequency(16000)
      .audioChannels(1)
      .audioBitrate(16)
      .format('wav')
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .save(outputPath);
  });
};

// ElevenLabs Scribe transcription
const transcribeWithElevenLabs = async (audioFilePath) => {
  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
  
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not configured');
  }
  
  const FormData = require('form-data');
  const formData = new FormData();
  
  // Create a readable stream from the audio file
  const audioStream = fs.createReadStream(audioFilePath);
  formData.append('audio', audioStream, {
    filename: 'audio.wav',
    contentType: 'audio/wav'
  });
  formData.append('model', 'eleven_multilingual_v2');
  formData.append('language', 'en');
  formData.append('timestamp_granularities[]', 'word');
  formData.append('timestamp_granularities[]', 'segment');
  formData.append('response_format', 'verbose_json');
  
  try {
    const response = await axios.post('https://api.elevenlabs.io/v1/speech-to-text', formData, {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        ...formData.getHeaders()
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });
    
    return response.data;
  } catch (error) {
    console.error('ElevenLabs transcription error:', error.response?.data || error.message);
    throw error;
  }
};

// GPTZero AI detection
const detectAIWithGPTZero = async (text) => {
  const GPTZERO_API_KEY = process.env.GPTZERO_API_KEY;
  
  if (!GPTZERO_API_KEY) {
    throw new Error('GPTZero API key not configured');
  }
  
  try {
    const response = await axios.post('https://api.gptzero.me/v2/predict/text', {
      document: text
    }, {
      headers: {
        'Authorization': `Bearer ${GPTZERO_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('GPTZero detection error:', error.response?.data || error.message);
    throw error;
  }
};

// Process transcript with AI detection
const processTranscriptWithAI = async (transcript) => {
  if (!transcript.segments) {
    return transcript;
  }
  
  for (const segment of transcript.segments) {
    if (segment.text && segment.text.trim()) {
      try {
        const aiDetection = await detectAIWithGPTZero(segment.text);
        segment.ai_probability = aiDetection.documents?.[0]?.average_generated_prob || 0;
      } catch (error) {
        console.error('AI detection failed for segment:', error.message);
        segment.ai_probability = null;
      }
    }
  }
  
  return transcript;
};

// Main analysis function
const analyzeYouTubeVideo = async (url, taskId) => {
  try {
    console.log(`Starting analysis for task ${taskId}`);
    
    // Update status
    results.set(taskId, { status: 'processing', progress: 'Taking screenshot...' });
    
    // Take screenshot
    const screenshotPath = `./screenshots/${taskId}.png`;
    await takeScreenshot(url, screenshotPath);
    
    // Update status
    results.set(taskId, { status: 'processing', progress: 'Downloading audio...' });
    
    // Download and convert audio
    const audioPath = `./audio/${taskId}.wav`;
    await downloadAndConvertAudio(url, audioPath);
    
    // Update status
    results.set(taskId, { status: 'processing', progress: 'Transcribing audio...' });
    
    // Transcribe with ElevenLabs
    const transcript = await transcribeWithElevenLabs(audioPath);
    
    // Update status
    results.set(taskId, { status: 'processing', progress: 'Analyzing AI content...' });
    
    // Process with GPTZero
    const enhancedTranscript = await processTranscriptWithAI(transcript);
    
    // Save results
    const resultData = {
      id: taskId,
      url: url,
      timestamp: new Date().toISOString(),
      screenshot_path: screenshotPath,
      transcript: enhancedTranscript,
      status: 'completed'
    };
    
    const resultPath = `./results/${taskId}.json`;
    await fs.writeJson(resultPath, resultData, { spaces: 2 });
    
    // Update in-memory storage
    results.set(taskId, resultData);
    
    console.log(`Analysis completed for task ${taskId}`);
    
  } catch (error) {
    console.error(`Analysis failed for task ${taskId}:`, error);
    results.set(taskId, {
      id: taskId,
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Routes

// Serve the web form
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// REST API endpoint for analysis
app.post('/analyze', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }
    
    if (!isValidYouTubeUrl(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }
    
    // Verify URL is accessible
    try {
      const info = await ytdl.getInfo(url);
      if (!info) {
        return res.status(400).json({ error: 'Unable to access YouTube video' });
      }
    } catch (error) {
      return res.status(400).json({ error: 'Unable to access YouTube video: ' + error.message });
    }
    
    const taskId = uuidv4();
    
    // Initialize task status
    results.set(taskId, { status: 'queued', timestamp: new Date().toISOString() });
    
    // Start analysis in background
    analyzeYouTubeVideo(url, taskId).catch(console.error);
    
    res.json({ 
      task_id: taskId, 
      status: 'queued',
      message: 'Analysis started. Use GET /result/' + taskId + ' to check progress.'
    });
    
  } catch (error) {
    console.error('Analysis request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get analysis result
app.get('/result/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = results.get(id);
    
    if (!result) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('Result retrieval error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const startServer = async () => {
  await ensureDirectories();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`YouTube Analyzer service running on http://0.0.0.0:${PORT}`);
    console.log('Environment variables needed:');
    console.log('- ELEVENLABS_API_KEY: Your ElevenLabs API key');
    console.log('- GPTZERO_API_KEY: Your GPTZero API key');
  });
};

startServer().catch(console.error); 