#!/bin/bash

# YouTube Analyzer GCE Deployment Script
# Run this script on your Google Cloud Engine VM

set -e

echo "🚀 Starting YouTube Analyzer deployment on GCE..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
echo "📦 Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install FFmpeg
echo "📦 Installing FFmpeg..."
sudo apt install -y ffmpeg

# Install Git
echo "📦 Installing Git..."
sudo apt install -y git

# Install PM2 for process management
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Create application directory
echo "📁 Creating application directory..."
sudo mkdir -p /opt/youtube-analyzer
sudo chown $USER:$USER /opt/youtube-analyzer
cd /opt/youtube-analyzer

# Clone repository (replace with your repository URL)
echo "📥 Cloning repository..."
if [ -z "$1" ]; then
    echo "❌ Error: Please provide repository URL as first argument"
    echo "Usage: ./gce-setup.sh https://github.com/your-username/youtube-analyzer.git"
    exit 1
fi

git clone $1 .

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Create environment file
echo "🔐 Creating environment file..."
cat > .env << EOF
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
GPTZERO_API_KEY=your_gptzero_api_key_here
PORT=8080
NODE_ENV=production
EOF

echo "⚠️  IMPORTANT: Edit .env file with your actual API keys:"
echo "   nano .env"
echo ""

# Create necessary directories
echo "📁 Creating application directories..."
mkdir -p screenshots audio results uploads

# Set up PM2 ecosystem file
echo "⚙️  Creating PM2 ecosystem file..."
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'youtube-analyzer',
    script: 'index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# Create logs directory
mkdir -p logs

# Set up log rotation
echo "📝 Setting up log rotation..."
sudo tee /etc/logrotate.d/youtube-analyzer << EOF
/opt/youtube-analyzer/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    notifempty
    create 644 $USER $USER
    postrotate
        pm2 reloadLogs
    endscript
}
EOF

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Edit the environment file with your API keys:"
echo "   nano .env"
echo ""
echo "2. Start the application:"
echo "   pm2 start ecosystem.config.js"
echo ""
echo "3. Set PM2 to start on boot:"
echo "   pm2 startup"
echo "   pm2 save"
echo ""
echo "4. Test the service:"
echo "   curl http://localhost:8080/health"
echo ""
echo "🔗 External access (if firewall is configured):"
echo "   http://$(curl -s ifconfig.me):8080"