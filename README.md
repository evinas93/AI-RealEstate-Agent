# AI-Powered Real Estate Agent 🤖🏠

A TypeScript CLI application with AI conversational interface for intelligent property search and evaluation.

## 🚀 Quick Start

```bash
# Install pnpm (if needed)
npm install -g pnpm

# Setup and run
pnpm install
echo "OPENAI_API_KEY=your_key_here" > .env
echo "USE_MOCK_DATA=true" >> .env
pnpm run dev
```

## ✨ Key Features

### 🤖 **AI Conversational Mode**
- Natural language property search
- Intelligent criteria extraction
- Context-aware recommendations
- Conversation memory

### 🏠 **Smart Property Search** 
- Multi-API integration (Zillow, Apify, mock data)
- 100-point ranking algorithm
- Advanced filtering and deduplication
- CSV/JSON export with conversation history

### 📊 **Evaluation & Tracing System** *(NEW)*
- **Conversation Quality**: Accuracy, relevance, helpfulness metrics
- **Search Performance**: Relevance, diversity, ranking evaluation  
- **Real-time Monitoring**: API performance, response times, error tracking
- **Automated Evaluations**: Continuous monitoring and alerting

## 🔧 Configuration

### Required
- **OpenAI API Key**: Get from [platform.openai.com](https://platform.openai.com/api-keys)

### Optional  
- **RapidAPI Key**: For real Zillow data
- **Apify Token**: For web scraping

See [SETUP_ENV.md](./SETUP_ENV.md) for detailed setup.

## 🎯 Usage Examples

### Basic Property Search
```
You: I need a 3-bedroom house in Columbus under $500k
AI: I'll help you find houses in Columbus, Ohio with 3+ bedrooms under $500,000...
```

### Run Evaluations
```bash
# Full evaluation dashboard
pnpm run eval

# Test specific components
pnpm run eval:conversation
pnpm run eval:property
```

## 📁 Project Structure

```
src/
├── agents/          # AI conversational agent
├── api/             # External API integrations  
├── evals/           # Evaluation framework
├── tracing/         # Performance monitoring
├── cli/             # Interactive commands
├── services/        # Business logic & ranking
└── utils/           # Utilities & export
```

## 📊 Evaluation Dashboard

```
📊 EVALUATION DASHBOARD
🎯 Overall Score: 87.3%

📈 Score Breakdown:
  🤖 Conversation Quality: 89.1%
  🏠 Property Search: 85.7%  
  ⚡ Performance: 87.2%

💡 Recommendations:
  1. Improve AI response times
  2. Enhance result diversification
```

## 🚀 Development

```bash
# Development mode
pnpm run dev

# Build for production
pnpm run build

# Run evaluations
pnpm run eval

# Run with monitoring
pnpm run eval:demo
```

## 📚 Documentation

- **[Evaluation Guide](./EVALUATIONS_AND_TRACING_GUIDE.md)**: Complete evaluation system docs
- **[Environment Setup](./SETUP_ENV.md)**: Detailed configuration guide

## 🏆 What's New

✅ **AI Quality Metrics**: Measure conversation accuracy and helpfulness  
✅ **Search Evaluation**: Track relevance and ranking performance  
✅ **Real-time Monitoring**: Live performance dashboards  
✅ **Automated Testing**: Continuous evaluation and alerting  
✅ **Production Ready**: Comprehensive tracing and error tracking

Perfect for developers building production AI applications who need confidence in their system's performance and quality.