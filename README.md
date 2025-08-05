# YouTube Analyzer Service

A comprehensive Node.js service that analyzes YouTube videos with AI-powered transcription and content detection.

## Features

- 🎥 **YouTube Video Processing**: Submit URLs via web form or REST API
- 📸 **Screenshot Capture**: Uses Puppeteer to verify playback and capture thumbnails
- 🎵 **Audio Extraction**: Downloads and converts audio to WAV (16kHz, mono, 16-bit) using ytdl-core and FFmpeg
- 📝 **AI Transcription**: ElevenLabs Scribe integration with word-level timestamps and speaker diarisation
- 🤖 **AI Detection**: GPTZero integration to detect AI-generated content in transcripts
- 💾 **Persistent Storage**: JSON results with screenshot paths
- 🌐 **REST API**: Simple endpoints for analysis and result retrieval

## Quick Start

### Prerequisites

- Node.js 18+ 
- FFmpeg installed
- ElevenLabs API key
- GPTZero API key

### Installation

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd youtube-analyzer
npm install
```

2. **Set environment variables:**
```bash
export ELEVENLABS_API_KEY="your_elevenlabs_api_key"
export GPTZERO_API_KEY="your_gptzero_api_key"
export PORT=8080
```

3. **Start the service:**
```bash
npm start
```

The service will be available at `http://localhost:8080`

## API Documentation

### Submit Analysis

**POST** `/analyze`

Submit a YouTube URL for analysis.

```bash
curl -X POST http://localhost:8080/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

**Response:**
```json
{
  "task_id": "123e4567-e89b-12d3-a456-426614174000",
  "status": "queued",
  "message": "Analysis started. Use GET /result/123e4567-e89b-12d3-a456-426614174000 to check progress."
}
```

### Get Results

**GET** `/result/:task_id`

Retrieve analysis results.

```bash
curl http://localhost:8080/result/123e4567-e89b-12d3-a456-426614174000
```

**Response (In Progress):**
```json
{
  "status": "processing",
  "progress": "Transcribing audio..."
}
```

**Response (Completed):**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "screenshot_path": "./screenshots/123e4567-e89b-12d3-a456-426614174000.png",
  "transcript": {
    "segments": [
      {
        "text": "Never gonna give you up",
        "start": 0.5,
        "end": 2.1,
        "speaker": "Speaker_1",
        "ai_probability": 0.15
      }
    ]
  },
  "status": "completed"
}
```

### Health Check

**GET** `/health`

```bash
curl http://localhost:8080/health
```

## Google Cloud Engine Deployment

### 1. Prepare the VM

Create a VM instance:

```bash
gcloud compute instances create youtube-analyzer \
  --image-family=ubuntu-2004-lts \
  --image-project=ubuntu-os-cloud \
  --machine-type=e2-standard-2 \
  --zone=us-central1-a \
  --boot-disk-size=20GB \
  --tags=youtube-analyzer
```

### 2. Configure Firewall Rules

Create firewall rule to allow traffic on port 8080:

```bash
gcloud compute firewall-rules create allow-youtube-analyzer \
  --allow tcp:8080 \
  --source-ranges 0.0.0.0/0 \
  --target-tags youtube-analyzer \
  --description "Allow YouTube Analyzer service on port 8080"
```

### 3. SSH and Setup

SSH into the instance:

```bash
gcloud compute ssh youtube-analyzer --zone=us-central1-a
```

Install Node.js and dependencies:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install FFmpeg
sudo apt install -y ffmpeg

# Install Git
sudo apt install -y git

# Clone your repository
git clone <your-repository-url>
cd youtube-analyzer

# Install dependencies
npm install

# Install PM2 for process management
sudo npm install -g pm2
```

### 4. Set Environment Variables

Create environment file:

```bash
cat > .env << EOF
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
GPTZERO_API_KEY=your_gptzero_api_key_here
PORT=8080
EOF
```

### 5. Start with PM2

```bash
# Start the service
pm2 start index.js --name youtube-analyzer

# Set PM2 to start on boot
pm2 startup
pm2 save
```

### 6. Verify Deployment

Test the service:

```bash
# Local test
curl http://localhost:8080/health

# External test (replace with your VM's external IP)
curl http://EXTERNAL_IP:8080/health
```

### SSH Port Forwarding (Fallback)

If direct access is not available, use SSH port forwarding:

```bash
# From your local machine
gcloud compute ssh youtube-analyzer \
  --zone=us-central1-a \
  --ssh-flag="-L 8080:localhost:8080"
```

Then access the service at `http://localhost:8080` on your local machine.

## Docker Deployment

### Build and Run

```bash
# Build the image
docker build -t youtube-analyzer .

# Run the container
docker run -d \
  -p 8080:8080 \
  -e ELEVENLABS_API_KEY=your_key_here \
  -e GPTZERO_API_KEY=your_key_here \
  --name youtube-analyzer \
  youtube-analyzer
```

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  youtube-analyzer:
    build: .
    ports:
      - "8080:8080"
    environment:
      - ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY}
      - GPTZERO_API_KEY=${GPTZERO_API_KEY}
    volumes:
      - ./data:/usr/src/app/data
    restart: unless-stopped
```

Run with:
```bash
docker-compose up -d
```

## Project Structure

```
youtube-analyzer/
├── index.js              # Main server file
├── package.json           # Dependencies and scripts
├── Dockerfile            # Docker configuration
├── README.md             # This file
├── public/
│   └── index.html        # Web interface
├── screenshots/          # Generated screenshots
├── audio/               # Temporary audio files
├── results/             # JSON results storage
└── uploads/             # File uploads directory
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ELEVENLABS_API_KEY` | Yes | API key for ElevenLabs Scribe |
| `GPTZERO_API_KEY` | Yes | API key for GPTZero |
| `PORT` | No | Server port (default: 8080) |

## Troubleshooting

### Common Issues

1. **FFmpeg not found**: Install FFmpeg on your system
2. **Puppeteer issues**: May need additional Chrome dependencies
3. **API rate limits**: Check your API quotas for ElevenLabs and GPTZero
4. **Firewall blocking**: Ensure port 8080 is open

### Logs

Check logs with PM2:
```bash
pm2 logs youtube-analyzer
```

Or with Docker:
```bash
docker logs youtube-analyzer
```

## Security Considerations

- Store API keys securely (use environment variables)
- Consider implementing authentication for production use
- Monitor API usage and costs
- Regularly update dependencies

## License

MIT License 