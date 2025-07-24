#!/bin/bash

echo "🤖 AI Real Estate Agent - Environment Setup"
echo "=========================================="
echo ""

# Check if .env already exists
if [ -f .env ]; then
    echo "⚠️  .env file already exists!"
    echo -n "Do you want to overwrite it? (y/N): "
    read -r response
    if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "Setup cancelled."
        exit 0
    fi
fi

# Create .env file
echo "Creating .env file..."
cat > .env << 'EOL'
# AI Configuration
# Get your OpenAI API key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=your_openai_api_key_here
AI_MODEL=gpt-3.5-turbo
AI_TEMPERATURE=0.7
CONVERSATION_MEMORY_ENABLED=true
MAX_CONVERSATIONS=10

# Real Estate API Configuration
# Set to false to use real API data (requires API keys below)
USE_MOCK_DATA=true

# Apify Configuration (Optional - for real property data)
# Get your API token from: https://console.apify.com/account/integrations
APIFY_API_TOKEN=
APIFY_REAL_ESTATE_ACTOR_ID=petr_cermak/real-estate-scraper

# RapidAPI Configuration (Optional - for Zillow data)
# Get your API key from: https://rapidapi.com/
RAPIDAPI_KEY=
ZILLOW_API_HOST=zillow-com1.p.rapidapi.com

# App Configuration
NODE_ENV=development
API_TIMEOUT=30000
MAX_RESULTS_PER_API=20
EOL

echo "✅ .env file created successfully!"
echo ""
echo "Next steps:"
echo "1. Edit .env and add your OpenAI API key"
echo "2. Run 'npm install' to install dependencies"
echo "3. Run 'npm run dev' to start the application"
echo ""
echo "For detailed setup instructions, see SETUP_ENV.md" 