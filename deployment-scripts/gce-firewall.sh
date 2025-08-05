#!/bin/bash

# Google Cloud Engine Firewall Configuration Script
# Run this script from your local machine with gcloud CLI configured

set -e

echo "🔥 Configuring GCE firewall for YouTube Analyzer..."

# Create firewall rule for the service
echo "📡 Creating firewall rule for port 8080..."
gcloud compute firewall-rules create allow-youtube-analyzer \
  --allow tcp:8080 \
  --source-ranges 0.0.0.0/0 \
  --target-tags youtube-analyzer \
  --description "Allow YouTube Analyzer service on port 8080" \
  --quiet

echo "✅ Firewall rule 'allow-youtube-analyzer' created successfully!"

# Optional: Create SSH rule if needed
read -p "🔐 Do you want to create an SSH firewall rule? (y/N): " create_ssh
if [[ $create_ssh =~ ^[Yy]$ ]]; then
    echo "📡 Creating SSH firewall rule..."
    gcloud compute firewall-rules create allow-ssh \
      --allow tcp:22 \
      --source-ranges 0.0.0.0/0 \
      --description "Allow SSH access" \
      --quiet
    echo "✅ SSH firewall rule created!"
fi

echo ""
echo "📋 Firewall Rules Summary:"
gcloud compute firewall-rules list --filter="name:(allow-youtube-analyzer OR allow-ssh)" --format="table(name,direction,priority,sourceRanges.list():label=SRC_RANGES,allowed[].map().firewall_rule().list():label=ALLOW,targetTags.list():label=TARGET_TAGS)"

echo ""
echo "🚀 Next steps:"
echo "1. Create a VM instance with the youtube-analyzer tag:"
echo "   gcloud compute instances create youtube-analyzer \\"
echo "     --image-family=ubuntu-2004-lts \\"
echo "     --image-project=ubuntu-os-cloud \\"
echo "     --machine-type=e2-standard-2 \\"
echo "     --zone=us-central1-a \\"
echo "     --boot-disk-size=20GB \\"
echo "     --tags=youtube-analyzer"
echo ""
echo "2. SSH into the instance and run the setup script:"
echo "   gcloud compute ssh youtube-analyzer --zone=us-central1-a"