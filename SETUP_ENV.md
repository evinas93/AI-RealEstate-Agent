# Environment Setup Guide

## Creating Your .env File

1. Create a new file named `.env` in the root directory of the project
2. Copy and paste the following configuration:

```bash
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

# Strict API Mode (Optional)
# When true, disables mock data fallbacks if valid API keys are present
# Set to true to ensure you only get real data or clear error messages
STRICT_API_MODE=false

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
```

## Configuration Details

### Required for AI Mode:
- **OPENAI_API_KEY**: Your OpenAI API key (required for conversational AI mode)
  - Get it from: https://platform.openai.com/api-keys
  - Pricing: https://openai.com/pricing

### Optional API Keys (for real property data):
- **APIFY_API_TOKEN**: For web scraping real estate data
- **RAPIDAPI_KEY**: For Zillow API access

### Configuration Options:
- **AI_MODEL**: Choose between `gpt-3.5-turbo` (cheaper) or `gpt-4` (more accurate)
- **AI_TEMPERATURE**: Controls randomness (0.0 = deterministic, 1.0 = creative)
- **USE_MOCK_DATA**: Set to `true` to use mock data (no API calls needed)
- **STRICT_API_MODE**: When `true`, disables mock data fallbacks if valid API keys exist
  - Ensures you get real data or clear error messages (no confusing mock data)
  - Recommended when you have valid API keys and want predictable behavior

## Quick Start

1. For AI mode with mock data (no external APIs needed):
   ```bash
   OPENAI_API_KEY=sk-your-key-here
   USE_MOCK_DATA=true
   ```

2. For full functionality with real data:
   ```bash
   OPENAI_API_KEY=sk-your-key-here
   USE_MOCK_DATA=false
   APIFY_API_TOKEN=your-apify-token
   RAPIDAPI_KEY=your-rapidapi-key
   ```

3. For strict API mode (real data only, no mock fallbacks):
   ```bash
   OPENAI_API_KEY=sk-your-key-here
   USE_MOCK_DATA=false
   STRICT_API_MODE=true
   RAPIDAPI_KEY=your-rapidapi-key
   ```

## Package Manager

This project uses **pnpm** instead of npm for package management. Make sure you have pnpm installed:

```bash
# Install pnpm globally
npm install -g pnpm

# Or enable via Corepack (Node.js 16.9+)
corepack enable
```

Then use pnpm commands:
```bash
pnpm install    # Install dependencies
pnpm run dev    # Run development server
pnpm run build  # Build the project
```

## Notes
- The `.env` file is ignored by git for security
- Never commit your API keys to version control
- You can run the app without any API keys using mock data mode
- This project enforces pnpm usage to ensure consistent dependency resolution 