# AI-Powered Real Estate Agent 🤖🏠

A TypeScript CLI application for searching real estate properties with AI conversational interface and intelligent ranking capabilities.

## 🚀 Quick Start

### Prerequisites
This project uses [pnpm](https://pnpm.io/) as the package manager. Install it first:

```bash
# Install pnpm globally
npm install -g pnpm

# Or using Corepack (Node.js 16.9+)
corepack enable
corepack prepare pnpm@9.0.0 --activate
```

### Installation

```bash
# Install dependencies
pnpm install

# Run the application
pnpm run dev
```

## ✨ Features

### 🤖 AI Conversational Mode (NEW!)
- **Natural Language Interface**: Talk to the AI agent in plain English
- **Conversation Memory**: The AI remembers your preferences throughout the conversation
- **Intelligent Understanding**: Automatically extracts search criteria from natural conversation
- **Context-Aware Responses**: The AI provides personalized recommendations based on your needs

### 🏠 Core Features
- **🔍 Multi-API Integration**: Apify, Zillow, mock data support
- **🏆 Smart Ranking System**: 100-point scoring algorithm based on price match, features, and recency
- **🎯 Advanced Filtering**: Price range, property type, bedrooms, bathrooms, features
- **📊 Deduplication**: Automatic removal of duplicate listings
- **📁 Export Options**: CSV and JSON export with match scores and conversation history
- **🎨 Interactive CLI**: Beautiful terminal interface with colored tables
- **🔄 Iterative Search**: Refine searches and explore results interactively

## 📁 Project Structure

```
src/
├── agents/           # AI agents and conversation memory
├── api/              # API clients (Apify, Zillow, mock data)
├── cli/              # Interactive prompts and AI interface
├── config/           # Environment and API configuration
├── services/         # Core business logic and ranking system
├── types/            # TypeScript interfaces and enums
└── utils/            # Display formatting and export utilities
```

## 🤖 AI Conversational Mode Example

When you have an OpenAI API key configured, the app automatically switches to conversational mode:

```
🤖 AI Real Estate Assistant

Hello! I'm your AI-powered real estate assistant. I can help you find the perfect property.
Just tell me what you're looking for in natural language!

Examples:
- "I need a 3-bedroom house in Columbus under $500k"
- "Looking for a pet-friendly apartment to rent in Austin"
- "Show me condos with a pool near downtown"

You: I'm looking for a family home in Columbus, Ohio. We need at least 3 bedrooms 
and 2 bathrooms. Our budget is around $400,000 to $500,000. A garage would be great.
```

## 🔧 Configuration and Setup

1. **Create a `.env` file** in the project root directory
2. **Add your OpenAI API key** (required for AI conversational mode)
3. **Configure other settings** as needed

See [SETUP_ENV.md](./SETUP_ENV.md) for detailed configuration instructions.

### Quick Setup:

**Option 1: Use the setup script**

```bash
# On Linux/Mac:
./setup-env.sh

# On Windows:
setup-env.bat
```

**Option 2: Manual setup**

```bash
# Create .env file
echo "OPENAI_API_KEY=your_openai_api_key_here" > .env
echo "USE_MOCK_DATA=true" >> .env

# Install dependencies
pnpm install

# Run the application
pnpm run dev
```

### Getting API Keys:

- **OpenAI**: https://platform.openai.com/api-keys (Required for AI mode)
- **Apify**: https://console.apify.com/account/integrations (Optional)
- **RapidAPI**: https://rapidapi.com/ (Optional for Zillow data)

## 📦 Package Management

This project uses **pnpm** for package management, which offers several advantages:

- **Faster installations**: Up to 2x faster than npm
- **Disk space efficient**: Uses a content-addressable store
- **Strict dependency resolution**: Prevents phantom dependencies
- **Better monorepo support**: Built-in workspace support

### Common Commands:

```bash
# Install dependencies
pnpm install

# Add a dependency
pnpm add <package-name>

# Add a dev dependency
pnpm add -D <package-name>

# Remove a dependency
pnpm remove <package-name>

# Run scripts
pnpm run dev
pnpm run build
pnpm start

# Update dependencies
pnpm update
```