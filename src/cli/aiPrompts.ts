import inquirer from 'inquirer';
import chalk from 'chalk';
import { ConversationalAgent } from '../agents/conversationalAgent';
import { SearchCriteria } from '../types/property';
import { ConversationMemory } from '../agents/conversationMemory';
import config from '../config';

export class AIPrompts {
  private conversationalAgent: ConversationalAgent;
  private memory: ConversationMemory;

  constructor() {
    this.memory = new ConversationMemory(config.ai.conversationMemory.maxConversations);
    this.conversationalAgent = new ConversationalAgent(this.memory);
  }

  async startConversation(): Promise<{ 
    action: 'search' | 'exit' | 'export' | 'continue';
    searchCriteria?: SearchCriteria;
  }> {
    console.log(chalk.blue.bold('\n🤖 AI Real Estate Assistant\n'));
    console.log(chalk.cyan('Hello! I\'m your AI-powered real estate assistant. I can help you find the perfect property.'));
    console.log(chalk.cyan('Just tell me what you\'re looking for in natural language!\n'));
    console.log(chalk.gray('Examples:'));
    console.log(chalk.gray('- "I need a 3-bedroom house in Columbus under $500k"'));
    console.log(chalk.gray('- "Looking for a pet-friendly apartment to rent in Austin"'));
    console.log(chalk.gray('- "Show me condos with a pool near downtown"\n'));
    console.log(chalk.yellow('Type "exit" at any time to quit.\n'));

    // Start new conversation session
    this.memory.startNewSession();

    while (true) {
      const { userInput } = await inquirer.prompt([{
        type: 'input',
        name: 'userInput',
        message: chalk.green('You:'),
        prefix: ''
      }]);

      // Process user input with AI
      const result = await this.conversationalAgent.processUserInput(userInput);

      // Display AI response
      console.log(chalk.blue('\nAssistant:'), result.response);

      if (result.isExiting) {
        return { action: 'exit' };
      }

      if (result.shouldSearch && result.searchCriteria) {
        // Show what the AI understood
        console.log(chalk.yellow('\n📋 I understood you want to search for:'));
        this.displaySearchCriteria(result.searchCriteria);

        const { confirmSearch } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirmSearch',
          message: 'Should I search with these criteria?',
          default: true
        }]);

        if (confirmSearch) {
          return { action: 'search', searchCriteria: result.searchCriteria };
        }
      }
    }
  }

  async getNextAction(): Promise<'new' | 'refine' | 'export' | 'exit'> {
    console.log(chalk.cyan('\n\nWhat would you like to do next?'));
    
    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'Choose an action:',
      choices: [
        { name: '🔍 New conversation/search', value: 'new' },
        { name: '🔧 Refine current search', value: 'refine' },
        { name: '📁 Export results', value: 'export' },
        { name: '👋 Exit', value: 'exit' }
      ]
    }]);

    return action;
  }

  async refineConversation(previousCriteria: SearchCriteria): Promise<{
    action: 'search' | 'cancel';
    searchCriteria?: SearchCriteria;
  }> {
    console.log(chalk.cyan('\n🔧 Let\'s refine your search. Tell me what you\'d like to change.\n'));
    console.log(chalk.gray('Current search:', this.conversationalAgent.getConversationSummary()));

    while (true) {
      const { userInput } = await inquirer.prompt([{
        type: 'input',
        name: 'userInput',
        message: chalk.green('You:'),
        prefix: ''
      }]);

      if (userInput.toLowerCase().includes('cancel')) {
        return { action: 'cancel' };
      }

      // Process refinement with AI
      const result = await this.conversationalAgent.processUserInput(userInput);

      // Display AI response
      console.log(chalk.blue('\nAssistant:'), result.response);

      if (result.shouldSearch && result.searchCriteria) {
        // Show updated criteria
        console.log(chalk.yellow('\n📋 Updated search criteria:'));
        this.displaySearchCriteria(result.searchCriteria);

        const { confirmSearch } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirmSearch',
          message: 'Search with these updated criteria?',
          default: true
        }]);

        if (confirmSearch) {
          return { action: 'search', searchCriteria: result.searchCriteria };
        }
      }
    }
  }

  async getExportOptions(): Promise<{ format: 'csv' | 'json'; filename: string; includeConversation: boolean }> {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'format',
        message: 'Select export format:',
        choices: [
          { name: 'CSV', value: 'csv' },
          { name: 'JSON', value: 'json' }
        ]
      },
      {
        type: 'input',
        name: 'filename',
        message: 'Enter filename (without extension):',
        default: `real-estate-search-${new Date().toISOString().split('T')[0]}`,
        validate: (input: string) => input.trim().length > 0 || 'Filename is required'
      },
      {
        type: 'confirm',
        name: 'includeConversation',
        message: 'Include conversation history in export?',
        default: true
      }
    ]);

    return answers;
  }

  private displaySearchCriteria(criteria: SearchCriteria): void {
    console.log(`  📍 Location: ${criteria.city}${criteria.state ? `, ${criteria.state}` : ''}`);
    console.log(`  🏠 Type: ${criteria.propertyType === 'any' ? 'Any' : criteria.propertyType}`);
    console.log(`  📄 Listing: ${criteria.listingType === 'any' ? 'Buy or Rent' : criteria.listingType === 'rent' ? 'Rent' : 'Buy'}`);
    
    if (criteria.minPrice || criteria.maxPrice) {
      let priceStr = '  💰 Price: ';
      if (criteria.minPrice) priceStr += `$${criteria.minPrice.toLocaleString()}`;
      if (criteria.minPrice && criteria.maxPrice) priceStr += ' - ';
      if (criteria.maxPrice) priceStr += `$${criteria.maxPrice.toLocaleString()}`;
      if (criteria.listingType === 'rent') priceStr += '/month';
      console.log(priceStr);
    }
    
    if (criteria.bedrooms) console.log(`  🛏️  Bedrooms: ${criteria.bedrooms}+`);
    if (criteria.bathrooms) console.log(`  🚿 Bathrooms: ${criteria.bathrooms}+`);
    if (criteria.features && criteria.features.length > 0) {
      console.log(`  ✨ Features: ${criteria.features.join(', ')}`);
    }
  }

  getConversationHistory() {
    return this.memory.getConversationHistory();
  }

  getConversationSession() {
    return this.memory.exportSession();
  }
} 