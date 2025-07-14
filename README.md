# Real Estate CLI Search Tool

A powerful command-line tool for searching real estate properties across multiple APIs with advanced filtering, ranking, and export capabilities.

## Features

- 🔍 **Multi-API Search**: Integrates with multiple real estate APIs (Apify, Zillow, Realtor.com)
- 🎯 **Advanced Filtering**: Filter by city, price range, property type, bedrooms, bathrooms, and features
- 🏆 **Smart Ranking**: Intelligent scoring system based on your preferences
- 📊 **Deduplication**: Automatically removes duplicate listings
- 📁 **Export Options**: Export results to CSV or JSON formats
- 🎨 **Beautiful Display**: Clean, colorful terminal output with tables
- 🔄 **Interactive Workflow**: Refine searches and explore results interactively

## Installation

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm/yarn

### Setup

1. **Clone or download the project files**

2. **Install pnpm** (if not already installed):
   ```bash
   npm install -g pnpm
   ```

3. **Install dependencies**:
   ```bash
   pnpm install
   ```

4. **Configure API Keys** (Optional - for real data):
   
   a. Copy the environment template:
   ```bash
   cp .env.example .env
   ```
   
   b. Edit `.env` and add your API keys:
   ```env
   # For Apify (Web Scraping)
   APIFY_API_TOKEN=your_apify_token_here
   
   # For other APIs (as you obtain them)
   ZILLOW_API_KEY=your_zillow_key_here
   RAPIDAPI_KEY=your_rapidapi_key_here
   ```
   
   c. Set `USE_MOCK_DATA=false` to use real APIs

### Getting API Keys

The application supports multiple real estate APIs. Here's how to get started:

1. **Apify** (Recommended for starting):
   - Sign up at [apify.com](https://apify.com)
   - Get your API token from Account Settings
   - Use the real estate scraper: `petr_cermak/real-estate-scraper`

2. **RapidAPI** (Multiple real estate APIs):
   - Sign up at [rapidapi.com](https://rapidapi.com)
   - Subscribe to real estate APIs like Realty-in-US or Zillow
   - Copy your RapidAPI key

3. **Other Supported APIs**:
   - RentBerry API
   - Rentals.com API
   - Direct Zillow API (if available)

**Note**: The application works without API keys using mock data, perfect for testing and development.

## Usage

### Running the Application

```bash
# Development mode
pnpm dev

# Production mode
pnpm build
pnpm start
```

### Search Workflow

1. **Enter Search Criteria**:
   - City (required)
   - State (optional)
   - Property type (House, Apartment, Condo, etc.)
   - Price range
   - Minimum bedrooms/bathrooms
   - Desired features (Pool, Garage, etc.)

2. **Review Results**:
   - Properties are ranked by match score
   - View detailed information for top matches
   - See summary statistics

3. **Next Actions**:
   - Perform a new search
   - Refine current search
   - Export results to CSV/JSON
   - Exit

### Example Search

```
🏠 Welcome to Real Estate CLI Search Tool!

? Enter the city to search in: San Francisco
? Enter the state (optional): CA
? Select property type: Apartment
? Minimum price (optional): 2000
? Maximum price (optional): 4000
? Minimum bedrooms (optional): 2
? Select desired features: Garage, Pet-friendly

✔ Found 23 properties
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `USE_MOCK_DATA` | Use mock data instead of real APIs | `true` |
| `API_TIMEOUT` | API request timeout in milliseconds | `30000` |
| `MAX_RESULTS_PER_API` | Maximum results from each API | `50` |
| `NODE_ENV` | Environment (development/production) | `development` |

### API Configuration

Each API can be configured in the `.env` file. See `.env.example` for all available options.

## Development

### Project Structure

```
src/
├── api/           # API client implementations
├── cli/           # CLI prompts and interactions
├── config/        # Configuration management
├── services/      # Business logic
├── types/         # TypeScript type definitions
└── utils/         # Utility functions
```

### Building

```bash
pnpm build
```

### Package Manager Compatibility

This project is optimized for **pnpm** but also supports npm and yarn:

```bash
# Using pnpm (recommended)
pnpm install
pnpm dev

# Using npm
npm install
npm run dev

# Using yarn
yarn install
yarn dev
```

### Testing with Mock Data

By default, the application uses mock data. This is perfect for:
- Testing the user interface
- Development without API costs
- Demonstrating functionality

To switch to real APIs, set `USE_MOCK_DATA=false` in your `.env` file.

## Troubleshooting

### No API Keys Warning

If you see "No API keys configured. Using mock data.", you need to:
1. Copy `.env.example` to `.env`
2. Add at least one API key
3. Set `USE_MOCK_DATA=false`

### PowerShell Script Execution

If you get script execution errors on Windows:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Installing pnpm

If you don't have pnpm installed:

**Via npm:**
```bash
npm install -g pnpm
```

**Via PowerShell (Windows):**
```powershell
iwr https://get.pnpm.io/install.ps1 -useb | iex
```

**Via Homebrew (macOS):**
```bash
brew install pnpm
```

### Network Issues

If you encounter network errors with pnpm, you can:

1. **Use npm as fallback:**
   ```bash
   npm install
   npm run dev
   ```

2. **Configure pnpm registry (if needed):**
   ```bash
   pnpm config set registry https://registry.npmjs.org/
   ```

3. **Clear pnpm cache:**
   ```bash
   pnpm store prune
   ```

## License

MIT
