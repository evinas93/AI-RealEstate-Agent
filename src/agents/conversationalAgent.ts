import OpenAI from 'openai';
import { SearchCriteria, PropertyType, ListingType, Property } from '../types/property';
import { ConversationMemory, UserPreferences } from './conversationMemory';
import { LearningEngine, UserLearningProfile } from './learningEngine';
import { ProactiveSuggestionEngine, ProactiveSuggestion, MarketInsight } from './proactiveSuggestionEngine';
import config from '../config';
import chalk from 'chalk';

export class ConversationalAgent {
  private openai: OpenAI;
  private memory: ConversationMemory;
  private learningEngine: LearningEngine;
  private suggestionEngine: ProactiveSuggestionEngine;
  private userId?: string;

  constructor(memory: ConversationMemory, userId?: string) {
    this.memory = memory;
    this.userId = userId;
    this.learningEngine = new LearningEngine();
    this.suggestionEngine = new ProactiveSuggestionEngine();
    this.openai = new OpenAI({
      apiKey: config.ai.openai.apiKey,
    });
  }

  async processUserInput(input: string): Promise<{ 
    response: string; 
    shouldSearch: boolean; 
    searchCriteria?: SearchCriteria;
    isExiting?: boolean;
    suggestions?: ProactiveSuggestion[];
    marketInsights?: MarketInsight[];
  }> {
    // Add user message to memory
    this.memory.addMessage('user', input);

    // Check for exit intent
    if (this.isExitIntent(input)) {
      return {
        response: "Thank you for using the AI Real Estate Agent! Your conversation has been saved. Goodbye! 👋",
        shouldSearch: false,
        isExiting: true
      };
    }

    // Get conversation context
    const context = this.memory.getFullContext();
    const preferences = this.memory.getExtractedPreferences();

    try {
      // Get personalized context from learning engine
      const personalizedContext = this.learningEngine.getPersonalizedContext(this.userId);
      const modelOptimizations = this.learningEngine.getModelOptimizations();
      
      // Create enhanced prompt for OpenAI
      const systemPrompt = `You are an expert real estate assistant with deep market knowledge. Your job is to help users find the perfect property through intelligent conversation.
      
Current user preferences: ${JSON.stringify(preferences)}
${personalizedContext}

Your tasks:
1. Engage in natural, consultative conversation about their real estate needs
2. Ask strategic follow-up questions to gather complete information
3. Provide helpful insights and suggestions based on their criteria
4. Educate users about important factors they might not have considered
5. Ensure you have sufficient information before searching

IMPORTANT CRITERIA TO GATHER:
- Location (city, preferred neighborhoods, commute requirements)
- Property type and size (bedrooms, bathrooms, square footage)
- Budget (be specific about price range)
- Timeline (when do they need to move?)
- Lifestyle needs (parking, pets, amenities, utilities)
- Deal-breakers (what would eliminate a property?)

ADVANCED QUESTIONS TO ASK:
- "How important is commute time to work/downtown?"
- "Do you have any specific neighborhood preferences?"
- "Are you looking for move-in ready or willing to renovate?"
- "What's your ideal timeline for moving?"
- "Any specific amenities that are must-haves vs nice-to-haves?"

PROVIDE VALUE by sharing insights like:
- Market trends in their area
- Typical price ranges for their criteria
- Neighborhood highlights
- Things they should consider

Only respond with "READY_TO_SEARCH" when you have:
1. Location (city + any area preferences)
2. Property type and size preferences  
3. Clear budget range
4. Basic timeline/urgency
5. Key requirements (parking, pets, etc.)

Be consultative, not just transactional. Help them make informed decisions.

${modelOptimizations.conversationTips.length > 0 ? 
  '\nOptimization tips based on recent performance:\n' + modelOptimizations.conversationTips.join('\n') : ''}`;

      const completion = await this.openai.chat.completions.create({
        model: config.ai.openai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: context + '\nUser: ' + input }
        ],
        temperature: modelOptimizations.temperature,
        max_tokens: modelOptimizations.maxTokens,
      });

      const assistantResponse = completion.choices[0].message.content || '';
      
      // Add assistant response to memory
      this.memory.addMessage('assistant', assistantResponse);

      // Check if we should search
      const shouldSearch = assistantResponse.includes('READY_TO_SEARCH');
      let searchCriteria: SearchCriteria | undefined;

      if (shouldSearch) {
        // Extract search criteria
        const extracted = await this.extractSearchCriteria(context + '\nUser: ' + input);
        if (extracted) {
          // Enhance criteria with learned preferences
          searchCriteria = this.learningEngine.getEnhancedCriteria(extracted, this.userId);
          
          // Update memory with extracted preferences
          this.updateMemoryPreferences(searchCriteria);
          
          // Record search for learning
          if (this.userId) {
            this.suggestionEngine.recordSearch(this.userId, searchCriteria);
          }
        }
      }

      // Clean up the response (remove READY_TO_SEARCH marker)
      const cleanResponse = assistantResponse.replace('READY_TO_SEARCH', '').trim();

      return {
        response: cleanResponse,
        shouldSearch,
        searchCriteria
      };
    } catch (error) {
      console.error(chalk.red('Error processing user input:'), error);
      return {
        response: "I'm sorry, I encountered an error. Could you please rephrase your request?",
        shouldSearch: false
      };
    }
  }

  private async extractSearchCriteria(conversation: string): Promise<SearchCriteria | null> {
    try {
      const extractionPrompt = `Extract real estate search criteria from this conversation. Return ONLY valid JSON.

Conversation:
${conversation}

PROPERTY TYPE MAPPING EXAMPLES:
- "apartment", "apt", "apartment room", "apartment rooms", "rental unit", "flat", "studio" → "apartment"
- "house", "home", "single family", "detached home", "family house" → "house"  
- "condo", "condominium", "condo unit" → "condo"
- "townhouse", "townhome", "row house" → "townhouse"
- "any type", "doesn't matter", "either", "whatever" → "any"

LISTING TYPE MAPPING:
- "rent", "rental", "to rent", "looking to rent", "renting" → "rent"
- "buy", "purchase", "for sale", "looking to buy", "buying" → "buy"

Extract and return as JSON:
{
  "city": "extracted city name",
  "state": "extracted state (optional)",
  "listingType": "rent" | "buy" | "any",
  "minPrice": number or null,
  "maxPrice": number or null,
  "propertyType": "house" | "apartment" | "condo" | "townhouse" | "any",
  "bedrooms": number or null,
  "bathrooms": number or null,
  "features": ["array", "of", "features"]
}

IMPORTANT: Pay special attention to property type keywords. "Apartment rooms" or "apartment room" = "apartment"`;

      const completion = await this.openai.chat.completions.create({
        model: config.ai.openai.model,
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert at extracting real estate search criteria. Focus carefully on property type keywords. Return only valid JSON.'
          },
          { role: 'user', content: extractionPrompt }
        ],
        temperature: 0.1, // Lower temperature for more consistent extraction
      });

      const jsonStr = completion.choices[0].message.content || '{}';
      const extracted = JSON.parse(jsonStr);

      // Map to SearchCriteria format
      const criteria: SearchCriteria = {
        city: extracted.city || 'columbus', // Default city
        state: extracted.state,
        listingType: this.mapListingType(extracted.listingType),
        minPrice: extracted.minPrice,
        maxPrice: extracted.maxPrice,
        propertyType: this.mapPropertyType(extracted.propertyType),
        bedrooms: extracted.bedrooms,
        bathrooms: extracted.bathrooms,
        features: extracted.features || []
      };

      return criteria;
    } catch (error) {
      console.error(chalk.red('Error extracting search criteria:'), error);
      return null;
    }
  }

  private mapListingType(type: string): ListingType {
    const normalized = type?.toLowerCase();
    switch (normalized) {
      case 'rent':
        return ListingType.RENT;
      case 'buy':
      case 'sale':
        return ListingType.BUY;
      default:
        return ListingType.ANY;
    }
  }

  private mapPropertyType(type: string): PropertyType {
    const normalized = type?.toLowerCase().trim();
    
    // Handle apartment variations
    if (normalized.includes('apartment') || 
        normalized.includes('apt') || 
        normalized.includes('rental unit') ||
        normalized.includes('flat') ||
        normalized.includes('studio')) {
      return PropertyType.APARTMENT;
    }
    
    // Handle house variations  
    if (normalized.includes('house') || 
        normalized.includes('home') ||
        normalized.includes('single family') ||
        normalized.includes('detached') ||
        normalized.includes('family house')) {
      return PropertyType.HOUSE;
    }
    
    // Handle condo variations
    if (normalized.includes('condo') || 
        normalized.includes('condominium')) {
      return PropertyType.CONDO;
    }
    
    // Handle townhouse variations
    if (normalized.includes('townhouse') || 
        normalized.includes('townhome') ||
        normalized.includes('row house')) {
      return PropertyType.TOWNHOUSE;
    }
    
    // Default to any if no specific type detected
    return PropertyType.ANY;
  }

  private updateMemoryPreferences(criteria: SearchCriteria): void {
    const preferences: UserPreferences = {
      city: criteria.city,
      state: criteria.state,
      priceRange: {
        min: criteria.minPrice,
        max: criteria.maxPrice
      },
      propertyType: criteria.propertyType,
      bedrooms: criteria.bedrooms,
      bathrooms: criteria.bathrooms,
      features: criteria.features
    };
    
    this.memory.updatePreferences(preferences);
  }

  private isExitIntent(input: string): boolean {
    const exitPhrases = ['exit', 'quit', 'goodbye', 'bye', 'done', 'finish', 'stop'];
    const normalized = input.toLowerCase().trim();
    return exitPhrases.some(phrase => normalized.includes(phrase));
  }

  getConversationSummary(): string {
    const session = this.memory.getCurrentSession();
    if (!session) return 'No conversation history.';

    const preferences = session.extractedPreferences;
    const messageCount = session.messages.length;
    
    let summary = `\n📊 Conversation Summary:\n`;
    summary += `Messages exchanged: ${messageCount}\n`;
    
    if (preferences.city) summary += `Location: ${preferences.city}${preferences.state ? `, ${preferences.state}` : ''}\n`;
    if (preferences.priceRange) {
      summary += `Price range: `;
      if (preferences.priceRange.min) summary += `$${preferences.priceRange.min.toLocaleString()}`;
      if (preferences.priceRange.min && preferences.priceRange.max) summary += ' - ';
      if (preferences.priceRange.max) summary += `$${preferences.priceRange.max.toLocaleString()}`;
      summary += '\n';
    }
    if (preferences.propertyType) summary += `Property type: ${preferences.propertyType}\n`;
    if (preferences.bedrooms) summary += `Bedrooms: ${preferences.bedrooms}+\n`;
    if (preferences.bathrooms) summary += `Bathrooms: ${preferences.bathrooms}+\n`;
    if (preferences.features && preferences.features.length > 0) {
      summary += `Features: ${preferences.features.join(', ')}\n`;
    }

    return summary;
  }

  /**
   * Generate proactive suggestions and insights after a search
   */
  async generatePostSearchSuggestions(
    searchCriteria: SearchCriteria,
    searchResults: Property[]
  ): Promise<{
    suggestions: ProactiveSuggestion[];
    insights: MarketInsight[];
    followUpQuestions: string[];
  }> {
    const userProfile = this.userId ? await this.getUserProfile() : undefined;
    
    // Generate proactive suggestions
    const suggestions = await this.suggestionEngine.generateSuggestions(
      searchCriteria,
      searchResults,
      userProfile,
      this.userId
    );

    // Generate market insights
    const insights = this.suggestionEngine.generateMarketInsights(searchCriteria, searchResults);

    // Generate follow-up questions
    const followUpQuestions = this.suggestionEngine.generateFollowUpQuestions(
      searchCriteria,
      searchResults,
      userProfile
    );

    return {
      suggestions,
      insights,
      followUpQuestions
    };
  }

  /**
   * Learn from conversation outcomes
   */
  async recordLearning(
    conversationEvaluation: any,
    finalCriteria?: SearchCriteria,
    userFeedback?: { selectedProperties?: Property[]; wasHelpful?: boolean }
  ): Promise<void> {
    const session = this.memory.getCurrentSession();
    if (session) {
      await this.learningEngine.learnFromConversation(
        conversationEvaluation,
        session,
        finalCriteria,
        userFeedback
      );
    }
  }

  /**
   * Get user learning profile
   */
  private async getUserProfile(): Promise<UserLearningProfile | undefined> {
    // In a real implementation, this would fetch from the learning engine
    // For now, we'll simulate getting a profile
    return undefined;
  }

  /**
   * Get learning and suggestion stats
   */
  getAgentStats() {
    return {
      learning: this.learningEngine.getLearningStats(),
      suggestions: this.suggestionEngine.getSuggestionStats()
    };
  }
} 