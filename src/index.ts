#!/usr/bin/env node

import { CliPrompts } from './cli/prompts';
import { AIPrompts } from './cli/aiPrompts';
import { RealEstateApiClient } from './api/realEstateApi';
import { PropertyService } from './services/propertyService';
import { DisplayUtils } from './utils/display';
import { ExportUtils } from './utils/export';
import { Property, SearchCriteria, ExportOptions } from './types/property';
import { ConversationSession } from './agents/conversationMemory';
import ora from 'ora';
import chalk from 'chalk';
import config from './config';

class RealEstateCliApp {
  private prompts: CliPrompts;
  private aiPrompts: AIPrompts;
  private apiClient: RealEstateApiClient;
  private propertyService: PropertyService;
  private displayUtils: DisplayUtils;
  private exportUtils: ExportUtils;
  private currentProperties: Property[] = [];
  private currentCriteria: SearchCriteria | null = null;
  private useAI: boolean;
  private currentConversation: ConversationSession | null = null;

  constructor() {
    this.prompts = new CliPrompts();
    this.aiPrompts = new AIPrompts();
    this.apiClient = new RealEstateApiClient();
    this.propertyService = new PropertyService();
    this.displayUtils = new DisplayUtils();
    this.exportUtils = new ExportUtils();
    this.useAI = config.hasValidAIConfig();
  }

  async run(): Promise<void> {
    try {
      // Check if AI is available
      if (this.useAI) {
        console.log(chalk.blue.bold('\n🤖 AI-Powered Real Estate Agent\n'));
        await this.runAIMode();
      } else {
        console.log(chalk.blue.bold('\n🏠 Welcome to Real Estate CLI Search Tool!\n'));
        if (!config.ai.openai.apiKey) {
          console.log(chalk.yellow('💡 Tip: Add OPENAI_API_KEY to .env file to enable AI conversational mode!\n'));
        }
        await this.runTraditionalMode();
      }
    } catch (error) {
      this.displayUtils.displayError(`Application error: ${error}`);
      process.exit(1);
    }
  }

  private async runAIMode(): Promise<void> {
    while (true) {
      // Start AI conversation
      const result = await this.aiPrompts.startConversation();
      
      if (result.action === 'exit') {
        console.log(chalk.blue('\n👋 Thank you for using AI Real Estate Agent!'));
        return;
      }
      
      if (result.action === 'search' && result.searchCriteria) {
        await this.executeSearch(result.searchCriteria);
        
        // Store conversation for export
        this.currentConversation = this.aiPrompts.getConversationSession();
        
        // Handle post-search actions
        while (true) {
          const nextAction = await this.aiPrompts.getNextAction();
          
          switch (nextAction) {
            case 'new':
              break; // Break inner loop to start new conversation
            case 'refine':
              const refineResult = await this.aiPrompts.refineConversation(result.searchCriteria);
              if (refineResult.action === 'search' && refineResult.searchCriteria) {
                await this.executeSearch(refineResult.searchCriteria);
                this.currentConversation = this.aiPrompts.getConversationSession();
              }
              continue;
            case 'export':
              await this.exportResultsWithAI();
              continue;
            case 'exit':
              console.log(chalk.blue('\n👋 Thank you for using AI Real Estate Agent!'));
              return;
          }
          break; // Break to start new conversation
        }
      }
    }
  }

  private async runTraditionalMode(): Promise<void> {
    while (true) {
      const action = this.currentProperties.length > 0 
        ? await this.prompts.getNextAction()
        : 'new';

      switch (action) {
        case 'new':
          await this.performNewSearch();
          break;
        case 'refine':
          await this.refineSearch();
          break;
        case 'export':
          await this.exportResults();
          break;
        case 'exit':
          console.log(chalk.blue('\n👋 Thank you for using Real Estate CLI Search Tool!'));
          return;
      }
    }
  }

  private async performNewSearch(): Promise<void> {
    try {
      // Get search criteria
      const criteria = await this.prompts.getSearchCriteria();
      
      // Confirm search
      const confirmed = await this.prompts.confirmSearch(criteria);
      if (!confirmed) {
        this.displayUtils.displayInfo('Search cancelled.');
        return;
      }

      await this.executeSearch(criteria);
    } catch (error) {
      this.displayUtils.displayError(`Search failed: ${error}`);
    }
  }

  private async refineSearch(): Promise<void> {
    if (!this.currentCriteria) {
      this.displayUtils.displayWarning('No previous search to refine.');
      return;
    }

    try {
      this.displayUtils.displayInfo('Current search criteria:');
      console.log(JSON.stringify(this.currentCriteria, null, 2));
      
      const newCriteria = await this.prompts.getSearchCriteria();
      await this.executeSearch(newCriteria);
    } catch (error) {
      this.displayUtils.displayError(`Refine search failed: ${error}`);
    }
  }

  private async executeSearch(criteria: SearchCriteria): Promise<void> {
    const spinner = ora('Searching properties...').start();

    try {
      // Search properties from APIs
      const rawProperties = await this.apiClient.searchProperties(criteria);
      spinner.text = 'Processing results...';

      // Aggregate, deduplicate, and rank
      const processedProperties = this.propertyService.aggregateAndProcess(rawProperties, criteria);

      spinner.succeed(`Found ${processedProperties.length} properties`);

      // Store results
      this.currentProperties = processedProperties;
      this.currentCriteria = criteria;

      // Display results
      this.displayResults();

    } catch (error) {
      spinner.fail('Search failed');
      throw error;
    }
  }

  private displayResults(): void {
    if (this.currentProperties.length === 0) {
      this.displayUtils.displayWarning('No properties found matching your criteria.');
      return;
    }

    // Display summary
    const summary = this.propertyService.getSearchSummary(this.currentProperties);
    this.displayUtils.displaySearchSummary(summary);

    // Display properties
    this.displayUtils.displayProperties(this.currentProperties, 15);

    // Show top property details
    if (this.currentProperties.length > 0) {
      console.log(chalk.blue('\n🌟 Top Match:'));
      this.displayUtils.displayPropertyDetails(this.currentProperties[0]);
    }
  }

  private async exportResults(): Promise<void> {
    if (this.currentProperties.length === 0) {
      this.displayUtils.displayWarning('No properties to export.');
      return;
    }

    try {
      const exportOptions = await this.prompts.getExportOptions();
      
      const spinner = ora(`Exporting to ${exportOptions.format.toUpperCase()}...`).start();
      
      const filepath = await this.exportUtils.exportProperties({
        format: exportOptions.format,
        filename: exportOptions.filename,
        properties: this.currentProperties
      });

      spinner.succeed(`Exported ${this.currentProperties.length} properties to ${filepath}`);
    } catch (error) {
      this.displayUtils.displayError(`Export failed: ${error}`);
    }
  }

  private async exportResultsWithAI(): Promise<void> {
    if (this.currentProperties.length === 0) {
      this.displayUtils.displayWarning('No properties to export.');
      return;
    }

    try {
      const exportOptions = await this.aiPrompts.getExportOptions();
      
      const spinner = ora(`Exporting to ${exportOptions.format.toUpperCase()}...`).start();
      
      const exportData: ExportOptions = {
        format: exportOptions.format,
        filename: exportOptions.filename,
        properties: this.currentProperties
      };

      // Add conversation if requested and format is JSON
      if (exportOptions.includeConversation && exportOptions.format === 'json' && this.currentConversation) {
        exportData.conversation = {
          messages: this.currentConversation.messages,
          preferences: this.currentConversation.extractedPreferences
        };
      }
      
      const filepath = await this.exportUtils.exportProperties(exportData);

      spinner.succeed(`Exported ${this.currentProperties.length} properties to ${filepath}`);
      
      if (exportOptions.includeConversation && exportOptions.format === 'csv') {
        this.displayUtils.displayInfo('Note: Conversation history is only included in JSON exports.');
      }
    } catch (error) {
      this.displayUtils.displayError(`Export failed: ${error}`);
    }
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error(chalk.red('\n💥 Uncaught Exception:'), error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('\n💥 Unhandled Rejection:'), reason);
  process.exit(1);
});

// Run the application
const app = new RealEstateCliApp();
app.run().catch((error) => {
  console.error(chalk.red('\n💥 Application Error:'), error);
  process.exit(1);
});