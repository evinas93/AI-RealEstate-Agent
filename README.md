# 🏠 AI Real Estate Agent

> **Smart property search with AI conversations, beautiful exports, and comprehensive evaluation**

A modern TypeScript CLI that finds properties using natural language, ranks them intelligently, and exports stunning reports with built-in quality monitoring.

## 🚀 Quick Start

```bash
# 1. Install & setup
npm install -g pnpm
pnpm install

# 2. Add API key (optional)
echo "OPENAI_API_KEY=your_key_here" > .env

# 3. Start searching!
pnpm run dev
```

*Works immediately with mock data - no API keys required!*

## ✨ Features

- 🤖 **AI Chat Interface** - Talk naturally: *"Find me condos downtown under $500k"*
- 🏠 **Smart Search** - Multi-source property data with intelligent ranking
- 📊 **Beautiful Exports** - Stunning HTML reports, enhanced CSV, rich JSON
- 📈 **Market Insights** - Price analysis, investment ratings, recommendations
- ⚡ **Real-time Evaluation** - Performance monitoring and quality metrics
- 🔍 **AI Quality Tracking** - Conversation accuracy, relevance, helpfulness

## 🎯 How It Works

```
You: "Show me 2-bedroom condos in downtown"
AI:  🏠 Found 24 properties! Here are the top matches...
     📊 Export options: HTML report, CSV data, JSON insights
     📈 Quality Score: 89.2% | Performance: ⚡ 1.2s
```

## 🛠️ Setup Options

### Option 1: Mock Data (Instant)
```bash
echo "USE_MOCK_DATA=true" > .env
pnpm run dev  # Ready to go!
```

### Option 2: Real Data (Optional)
```bash
# Get keys from:
# - OpenAI: platform.openai.com
# - RapidAPI: rapidapi.com (for Zillow)

echo "OPENAI_API_KEY=your_key" > .env
echo "ZILLOW_API_KEY=your_key" >> .env
```

## 📁 Project Structure

```
src/
├── 🤖 agents/     # AI conversation logic
├── 🏠 api/        # Property data sources  
├── 📊 evals/      # Quality monitoring & evaluation
├── 🔍 tracing/    # Performance monitoring
├── 💼 services/   # Search & ranking
└── 🎨 utils/      # Export & display
```

## 🔧 Commands

```bash
pnpm run dev        # 🚀 Start the app
pnpm run build      # 📦 Build for production
pnpm run eval       # 📊 Run full evaluation suite
pnpm run eval:conversation  # 🤖 Test AI quality
pnpm run eval:property      # 🏠 Test search performance
```

## 📊 Evaluation Dashboard

Get real-time insights into your AI agent's performance:

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

### 🔍 What Gets Evaluated
- **🤖 Conversation Quality** - Accuracy, relevance, helpfulness metrics
- **🏠 Search Performance** - Relevance, diversity, ranking evaluation  
- **⚡ Real-time Monitoring** - API performance, response times, error tracking
- **📊 Automated Testing** - Continuous monitoring and alerting

## 📸 What You'll Get

### Beautiful Exports
- **🌐 HTML Reports** - Professional property showcases
- **📈 Enhanced CSV** - Emoji headers, calculated fields  
- **📊 Rich JSON** - Market insights, recommendations

### Smart Features
- **🎯 Match Scoring** - Properties ranked by your preferences
- **💡 Highlights** - Key selling points automatically detected
- **📈 Market Analysis** - Price trends and investment ratings
- **🏆 Top Picks** - Best value, newest, highest-rated properties

### Production Monitoring
- **📊 Quality Metrics** - Track AI conversation accuracy
- **⚡ Performance Tracking** - Monitor response times and errors
- **🔍 Evaluation Reports** - Comprehensive system health insights
- **📈 Continuous Improvement** - Data-driven optimization suggestions

## 🚀 Next Steps

1. **Try it now**: `pnpm run dev` 
2. **Export results**: Choose HTML for beautiful reports
3. **Monitor quality**: Run `pnpm run eval` to see performance metrics
4. **Add real data**: Get API keys for live property data

---

**Built for developers** who want production-ready AI applications with beautiful UX, comprehensive monitoring, and quality assurance. 

[📖 Evaluation Guide](./EVALUATIONS_AND_TRACING_GUIDE.md) | [⚙️ Setup Guide](./SETUP_ENV.md)