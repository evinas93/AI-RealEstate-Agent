import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface ApiConfig {
  apify: {
    apiToken: string;
    actorId: string;
    baseUrl: string;
  };
  zillow: {
    apiKey: string;
    apiHost: string;
  };
  rentberry: {
    apiKey: string;
    apiUrl: string;
  };
  rentals: {
    apiKey: string;
    apiUrl: string;
  };
  rapidApi: {
    key: string;
    host: string;
  };
}

export interface AIConfig {
  openai: {
    apiKey: string;
    model: string;
    temperature: number;
  };
  conversationMemory: {
    enabled: boolean;
    maxConversations: number;
  };
}

export interface AppConfig {
  nodeEnv: string;
  apiTimeout: number;
  maxResultsPerApi: number;
  useMockData: boolean;
  strictApiMode: boolean; // When true, never use mock data if valid API keys exist
}

class Config {
  private static instance: Config;
  public api: ApiConfig;
  public app: AppConfig;
  public ai: AIConfig;

  private constructor() {
    this.api = {
      apify: {
        apiToken: process.env.APIFY_API_TOKEN || '',
        actorId: process.env.APIFY_REAL_ESTATE_ACTOR_ID || 'petr_cermak/real-estate-scraper',
        baseUrl: 'https://api.apify.com/v2'
      },
      zillow: {
        apiKey: process.env.RAPIDAPI_KEY || '',
        apiHost: process.env.ZILLOW_API_HOST || 'zillow-com1.p.rapidapi.com'
      },
      rentberry: {
        apiKey: process.env.RENTBERRY_API_KEY || '',
        apiUrl: process.env.RENTBERRY_API_URL || 'https://api.rentberry.com/v1'
      },
      rentals: {
        apiKey: process.env.RENTALS_API_KEY || '',
        apiUrl: process.env.RENTALS_API_URL || 'https://api.rentals.com/v1'
      },
      rapidApi: {
        key: process.env.RAPIDAPI_KEY || '',
        host: process.env.RAPIDAPI_HOST || 'realty-in-us.p.rapidapi.com'
      }
    };

    this.app = {
      nodeEnv: process.env.NODE_ENV || 'development',
      apiTimeout: parseInt(process.env.API_TIMEOUT || '30000', 10),
      maxResultsPerApi: parseInt(process.env.MAX_RESULTS_PER_API || '20', 10),
      useMockData: process.env.USE_MOCK_DATA === 'true',
      strictApiMode: process.env.STRICT_API_MODE === 'true',
    };

    this.ai = {
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.AI_MODEL || 'gpt-3.5-turbo',
        temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7')
      },
      conversationMemory: {
        enabled: process.env.CONVERSATION_MEMORY_ENABLED !== 'false',
        maxConversations: parseInt(process.env.MAX_CONVERSATIONS || '10', 10)
      }
    };
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  public hasValidApifyConfig(): boolean {
    // Disabled - using only RapidAPI
    return false;
  }

  public hasValidZillowConfig(): boolean {
    return !!this.api.zillow.apiKey;
  }

  public hasValidRentberryConfig(): boolean {
    return !!this.api.rentberry.apiKey;
  }

  public hasValidRentalsConfig(): boolean {
    return !!this.api.rentals.apiKey;
  }

  public hasValidAIConfig(): boolean {
    return !!this.ai.openai.apiKey;
  }

  public hasAnyValidApiConfig(): boolean {
    return (
      this.hasValidApifyConfig() ||
      this.hasValidZillowConfig() ||
      this.hasValidRentberryConfig() ||
      this.hasValidRentalsConfig() ||
      false
    );
  }
}

export default Config.getInstance(); 