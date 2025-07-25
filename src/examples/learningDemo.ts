#!/usr/bin/env node

import chalk from 'chalk';
import { LearningEngine } from '../agents/learningEngine';
import { ProactiveSuggestionEngine } from '../agents/proactiveSuggestionEngine';
import { ConversationMemory } from '../agents/conversationMemory';
import { ConversationalAgent } from '../agents/conversationalAgent';
import { PropertyService } from '../services/propertyService';
import { SearchCriteria, PropertyType, ListingType, Property } from '../types/property';

class LearningDemo {
  private learningEngine: LearningEngine;
  private suggestionEngine: ProactiveSuggestionEngine;
  private propertyService: PropertyService;

  constructor() {
    this.learningEngine = new LearningEngine('./demo_learning_data.json');
    this.suggestionEngine = new ProactiveSuggestionEngine();
    this.propertyService = new PropertyService();
  }

  async runDemo(): Promise<void> {
    console.log(chalk.blue.bold('\n🧠 AI Learning & Proactive Suggestions Demo\n'));
    console.log(chalk.cyan('This demo shows how the AI learns from interactions and provides intelligent suggestions.\n'));

    // Demo 1: Learning from successful conversations
    await this.demoLearningFromConversations();

    // Demo 2: Proactive suggestions
    await this.demoProactiveSuggestions();

    // Demo 3: Enhanced search criteria
    await this.demoEnhancedCriteria();

    // Demo 4: Market insights
    await this.demoMarketInsights();

    console.log(chalk.green.bold('\n✨ Demo complete! The AI is now smarter and more helpful.\n'));
  }

  private async demoLearningFromConversations(): Promise<void> {
    console.log(chalk.yellow.bold('📚 Demo 1: Learning from Conversations\n'));

    // Simulate a successful conversation
    const memory = new ConversationMemory();
    const sessionId = memory.startNewSession();
    
    // Add conversation messages
    memory.addMessage('user', 'I\'m looking for a 3-bedroom house in Columbus under $400k');
    memory.addMessage('assistant', 'Great! I can help you find a house. Do you have any specific features in mind?');
    memory.addMessage('user', 'Yes, I need a garage and prefer newer construction');
    memory.addMessage('assistant', 'Perfect! Let me search for 3-bedroom houses in Columbus under $400k with garage and newer construction.');

    // Create criteria that was successfully extracted
    const successfulCriteria: SearchCriteria = {
      city: 'Columbus',
      listingType: ListingType.BUY,
      propertyType: PropertyType.HOUSE,
      maxPrice: 400000,
      bedrooms: 3,
      features: ['garage', 'new construction']
    };

    // Update preferences
    memory.updatePreferences({
      city: 'Columbus',
      priceRange: { max: 400000 },
      propertyType: 'house',
      bedrooms: 3,
      features: ['garage', 'new construction']
    });

    // Simulate high-quality evaluation
    const evaluation = {
      accuracy: 0.95,
      relevance: 0.9,
      helpfulness: 0.92,
      completeness: 0.88,
      naturalness: 0.93,
      overallScore: 0.916
    };

    const session = memory.getCurrentSession()!;

    // Learn from this successful interaction
    await this.learningEngine.learnFromConversation(
      evaluation,
      session,
      successfulCriteria,
      { wasHelpful: true }
    );

    console.log(chalk.green('✅ Learned from successful conversation'));
    console.log(chalk.gray('   - User prefers houses'));
    console.log(chalk.gray('   - Typical budget: $400k'));
    console.log(chalk.gray('   - Important features: garage, new construction'));
    console.log(chalk.gray('   - Conversation pattern: question -> clarification -> search'));

    const stats = this.learningEngine.getLearningStats();
    console.log(chalk.blue(`📊 Learning Stats: ${stats.totalPatterns} patterns, ${stats.totalUserProfiles} profiles\n`));
  }

  private async demoProactiveSuggestions(): Promise<void> {
    console.log(chalk.yellow.bold('🎯 Demo 2: Proactive Suggestions\n'));

    // Current search criteria
    const criteria: SearchCriteria = {
      city: 'Columbus',
      listingType: ListingType.BUY,
      propertyType: PropertyType.HOUSE,
      maxPrice: 450000,
      bedrooms: 2,
      features: []
    };

    // Simulate few search results (suggesting expansion)
    const limitedResults: Property[] = [
      {
        id: '1',
        address: '123 Main St',
        city: 'Columbus',
        state: 'OH',
        zipCode: '43215',
        listingType: ListingType.BUY,
        price: 425000,
        bedrooms: 2,
        bathrooms: 2,
        propertyType: PropertyType.HOUSE,
        features: ['garage', 'new construction'],
        imageUrls: [],
        listingUrl: 'https://example.com/1',
        source: 'demo',
        dateAdded: new Date()
      },
      {
        id: '2',
        address: '456 Oak Ave',
        city: 'Columbus',
        state: 'OH',
        zipCode: '43202',
        listingType: ListingType.BUY,
        price: 445000,
        bedrooms: 2,
        bathrooms: 2.5,
        propertyType: PropertyType.HOUSE,
        features: ['deck', 'updated kitchen'],
        imageUrls: [],
        listingUrl: 'https://example.com/2',
        source: 'demo',
        dateAdded: new Date()
      }
    ];

    const suggestions = await this.suggestionEngine.generateSuggestions(
      criteria,
      limitedResults
    );

    console.log(chalk.cyan('Current search: 2-bedroom houses in Columbus under $450k'));
    console.log(chalk.cyan(`Results found: ${limitedResults.length} properties\n`));

    console.log(chalk.blue.bold('💡 AI-Generated Suggestions:'));
    suggestions.forEach((suggestion, index) => {
      const priorityIcon = suggestion.priority === 'high' ? '🔥' : 
                          suggestion.priority === 'medium' ? '⭐' : '💭';
      
      console.log(chalk.yellow(`\n${index + 1}. ${priorityIcon} ${suggestion.title}`));
      console.log(chalk.gray(`   ${suggestion.description}`));
      console.log(chalk.gray(`   Reasoning: ${suggestion.reasoning}`));
      console.log(chalk.gray(`   Confidence: ${Math.round(suggestion.confidence * 100)}%`));
      
      if (suggestion.actionable) {
        console.log(chalk.green(`   ✨ Actionable: Yes`));
      }
    });

    console.log();
  }

  private async demoEnhancedCriteria(): Promise<void> {
    console.log(chalk.yellow.bold('🎨 Demo 3: Enhanced Search Criteria\n'));

    // Original basic criteria
    const basicCriteria: SearchCriteria = {
      city: 'Columbus',
      listingType: ListingType.BUY,
      propertyType: PropertyType.ANY,
      features: []
    };

    // Simulate user with learning history
    const userId = 'demo_user_123';

    console.log(chalk.cyan('Original criteria:'));
    console.log(chalk.gray(JSON.stringify(basicCriteria, null, 2)));

    // Enhance with learned preferences
    const enhancedCriteria = this.learningEngine.getEnhancedCriteria(basicCriteria, userId);

    console.log(chalk.blue('\nEnhanced with learned preferences:'));
    console.log(chalk.gray(JSON.stringify(enhancedCriteria, null, 2)));

    // Show personalized context
    const personalizedContext = this.learningEngine.getPersonalizedContext(userId);
    if (personalizedContext) {
      console.log(chalk.green('\nPersonalized AI context:'));
      console.log(chalk.gray(personalizedContext));
    }

    // Show model optimizations
    const optimizations = this.learningEngine.getModelOptimizations();
    console.log(chalk.blue('\nAI Model Optimizations:'));
    console.log(chalk.gray(`Temperature: ${optimizations.temperature}`));
    console.log(chalk.gray(`Max Tokens: ${optimizations.maxTokens}`));
    if (optimizations.conversationTips.length > 0) {
      console.log(chalk.gray('Tips:', optimizations.conversationTips.join(', ')));
    }

    console.log();
  }

  private async demoMarketInsights(): Promise<void> {
    console.log(chalk.yellow.bold('📊 Demo 4: Market Insights\n'));

    const criteria: SearchCriteria = {
      city: 'Columbus',
      listingType: ListingType.BUY,
      propertyType: PropertyType.CONDO,
      maxPrice: 300000,
      features: []
    };

    // Simulate search results
    const results: Property[] = Array.from({ length: 12 }, (_, i) => ({
      id: `market_${i}`,
      address: `${100 + i} Market St`,
      city: 'Columbus',
      state: 'OH',
      zipCode: '43215',
      listingType: ListingType.BUY,
      price: 250000 + (i * 15000),
      bedrooms: 2,
      bathrooms: 2,
      propertyType: PropertyType.CONDO,
      features: ['pool', 'fitness center', 'parking'],
      imageUrls: [],
      listingUrl: `https://example.com/market_${i}`,
      source: 'demo',
      dateAdded: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)) // Different ages
    }));

    const insights = this.suggestionEngine.generateMarketInsights(criteria, results);

    console.log(chalk.cyan(`Search: Condos in Columbus under $300k`));
    console.log(chalk.cyan(`Results: ${results.length} properties found\n`));

    console.log(chalk.blue.bold('📈 Market Insights:'));
    insights.forEach((insight, index) => {
      const impactIcon = insight.impact === 'positive' ? '📈' : 
                        insight.impact === 'negative' ? '📉' : '📊';
      
      console.log(chalk.green(`\n${index + 1}. ${impactIcon} ${insight.message}`));
      console.log(chalk.gray(`   Impact: ${insight.impact.toUpperCase()}`));
      console.log(chalk.gray(`   Timeframe: ${insight.timeframe}`));
      console.log(chalk.gray(`   Confidence: ${Math.round(insight.confidence * 100)}%`));
    });

    // Generate follow-up questions
    const questions = this.suggestionEngine.generateFollowUpQuestions(criteria, results);
    
    if (questions.length > 0) {
      console.log(chalk.blue.bold('\n🤔 Smart Follow-up Questions:'));
      questions.forEach((question, index) => {
        console.log(chalk.yellow(`${index + 1}. ${question}`));
      });
    }

    console.log();
  }
}

// Run the demo
async function runDemo() {
  const demo = new LearningDemo();
  await demo.runDemo();
}

// Only run if this file is executed directly
if (require.main === module) {
  runDemo().catch(console.error);
}

export { LearningDemo }; 