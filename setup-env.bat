@echo off
echo 🤖 AI Real Estate Agent - Environment Setup
echo ==========================================
echo.

rem Check if .env already exists
if exist .env (
    echo ⚠️  .env file already exists!
    set /p response="Do you want to overwrite it? (y/N): "
    if /i not "!response!"=="y" (
        echo Setup cancelled.
        exit /b 0
    )
)

rem Create .env file
echo Creating .env file...
(
echo # AI Configuration
echo # Get your OpenAI API key from: https://platform.openai.com/api-keys
echo OPENAI_API_KEY=your_openai_api_key_here
echo AI_MODEL=gpt-3.5-turbo
echo AI_TEMPERATURE=0.7
echo CONVERSATION_MEMORY_ENABLED=true
echo MAX_CONVERSATIONS=10
echo.
echo # Real Estate API Configuration
echo # Set to false to use real API data ^(requires API keys below^)
echo USE_MOCK_DATA=true
echo.
echo # Apify Configuration ^(Optional - for real property data^)
echo # Get your API token from: https://console.apify.com/account/integrations
echo APIFY_API_TOKEN=
echo APIFY_REAL_ESTATE_ACTOR_ID=petr_cermak/real-estate-scraper
echo.
echo # RapidAPI Configuration ^(Optional - for Zillow data^)
echo # Get your API key from: https://rapidapi.com/
echo RAPIDAPI_KEY=
echo ZILLOW_API_HOST=zillow-com1.p.rapidapi.com
echo.
echo # App Configuration
echo NODE_ENV=development
echo API_TIMEOUT=30000
echo MAX_RESULTS_PER_API=20
) > .env

echo ✅ .env file created successfully!
echo.
echo Next steps:
echo 1. Edit .env and add your OpenAI API key
echo 2. Run 'pnpm install' to install dependencies
echo 3. Run 'pnpm run dev' to start the application
echo.
echo For detailed setup instructions, see SETUP_ENV.md
pause 