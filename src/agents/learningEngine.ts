import { ConversationEvaluation } from '../evals/conversationEvals';
import { ConversationSession, UserPreferences } from './conversationMemory';
import { SearchCriteria, Property } from '../types/property';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

export interface LearningPattern {
  id: string;
  pattern: string;
  successRate: number;
  usageCount: number;
  lastUsed: Date;
  extractionAccuracy: number;
  userSatisfaction: number;
  weight: number;
}

export interface UserLearningProfile {
  userId: string;
  preferredPropertyTypes: Record<string, number>; // type -> preference weight
  priceRangePatterns: Array<{ min?: number; max?: number; frequency: number }>;
  featurePreferences: Record<string, number>; // feature -> importance weight
  conversationStyle: {
    prefersDetailedQuestions: boolean;
    respondsWellToSuggestions: boolean;
    needsMoreGuidance: boolean;
    averageResponseTime: number;
  };
  searchPatterns: {
    typicalSearchSequence: string[];
    refinementFrequency: number;
    exportPreferences: Record<string, number>;
  };
  lastUpdated: Date;
}

export class LearningEngine {
  private patterns: Map<string, LearningPattern> = new Map();
  private userProfiles: Map<string, UserLearningProfile> = new Map();
  private learningDataPath: string;
  private isLearningEnabled: boolean = true;

  constructor(learningDataPath: string = './learning_data.json') {
    this.learningDataPath = learningDataPath;
    this.loadLearningData();
  }

  /**
   * Learn from a completed conversation and its evaluation
   */
  async learnFromConversation(
    evaluation: ConversationEvaluation,
    session: ConversationSession,
    finalCriteria?: SearchCriteria,
    userFeedback?: { selectedProperties?: Property[]; wasHelpful?: boolean }
  ): Promise<void> {
    if (!this.isLearningEnabled) return;

    console.log(chalk.blue('\n🧠 Learning from conversation...'));

    // 1. Update conversation patterns based on success
    await this.updateConversationPatterns(evaluation, session);

    // 2. Learn user preferences from successful interactions
    if (evaluation.overallScore > 0.7 && finalCriteria) {
      this.updateUserPreferences(session, finalCriteria, userFeedback);
    }

    // 3. Learn from extraction accuracy
    this.updateExtractionPatterns(evaluation, session, finalCriteria);

    // 4. Adjust conversation style based on user response patterns
    this.updateConversationStyle(evaluation, session);

    // Save learning data
    this.saveLearningData();

    console.log(chalk.green('✅ Learning complete - patterns updated'));
  }

  /**
   * Get improved search criteria based on learned patterns
   */
  getEnhancedCriteria(
    originalCriteria: SearchCriteria,
    userId?: string
  ): SearchCriteria {
    if (!userId) return originalCriteria;

    const profile = this.userProfiles.get(userId);
    if (!profile) return originalCriteria;

    const enhanced = { ...originalCriteria };

    // Apply learned property type preferences
    if (!enhanced.propertyType || enhanced.propertyType === 'any') {
      const preferredType = this.getMostPreferredPropertyType(profile);
      if (preferredType) {
        enhanced.propertyType = preferredType as any;
        console.log(chalk.gray(`🎯 Applied learned preference: ${preferredType}`));
      }
    }

    // Enhance features based on learned preferences
    const suggestedFeatures = this.getSuggestedFeatures(profile, enhanced);
    enhanced.features = [...(enhanced.features || []), ...suggestedFeatures];

    // Adjust price range based on patterns
    const optimizedPriceRange = this.getOptimizedPriceRange(profile, enhanced);
    if (optimizedPriceRange) {
      enhanced.minPrice = optimizedPriceRange.min;
      enhanced.maxPrice = optimizedPriceRange.max;
    }

    return enhanced;
  }

  /**
   * Generate conversation context based on learned patterns
   */
  getPersonalizedContext(userId?: string): string {
    if (!userId) return '';

    const profile = this.userProfiles.get(userId);
    if (!profile) return '';

    const context = [];

    // Add learned conversation style adjustments
    if (profile.conversationStyle.prefersDetailedQuestions) {
      context.push("User prefers detailed questions and thorough exploration of options");
    }

    if (profile.conversationStyle.respondsWellToSuggestions) {
      context.push("User responds well to proactive suggestions and recommendations");
    }

    if (profile.conversationStyle.needsMoreGuidance) {
      context.push("User benefits from additional guidance and market education");
    }

    // Add learned property preferences
    const preferredType = this.getMostPreferredPropertyType(profile);
    if (preferredType) {
      context.push(`User typically prefers ${preferredType} properties`);
    }

    return context.length > 0 ? `\nLearned user preferences: ${context.join('. ')}.` : '';
  }

  /**
   * Get optimization suggestions for the AI model
   */
  getModelOptimizations(): {
    temperature: number;
    maxTokens: number;
    conversationTips: string[];
  } {
    const recentPatterns = Array.from(this.patterns.values())
      .filter(p => Date.now() - p.lastUsed.getTime() < 30 * 24 * 60 * 60 * 1000) // Last 30 days
      .sort((a, b) => b.successRate - a.successRate);

    const avgSuccessRate = recentPatterns.length > 0 
      ? recentPatterns.reduce((sum, p) => sum + p.successRate, 0) / recentPatterns.length
      : 0.5;

    // Adjust temperature based on success rate
    let temperature = 0.7;
    if (avgSuccessRate < 0.6) {
      temperature = 0.5; // More focused responses
    } else if (avgSuccessRate > 0.8) {
      temperature = 0.8; // Allow more creativity
    }

    const tips = [];
    if (avgSuccessRate < 0.7) {
      tips.push("Focus on asking clearer, more specific questions");
      tips.push("Ensure all required criteria are gathered before searching");
    }

    return {
      temperature,
      maxTokens: 1000,
      conversationTips: tips
    };
  }

  private async updateConversationPatterns(
    evaluation: ConversationEvaluation,
    session: ConversationSession
  ): Promise<void> {
    // Extract patterns from successful conversations
    if (evaluation.overallScore > 0.7) {
      const conversationFlow = this.extractConversationFlow(session);
      const patternId = this.generatePatternId(conversationFlow);
      
      let pattern = this.patterns.get(patternId);
      if (!pattern) {
        pattern = {
          id: patternId,
          pattern: conversationFlow,
          successRate: evaluation.overallScore,
          usageCount: 1,
          lastUsed: new Date(),
          extractionAccuracy: evaluation.accuracy,
          userSatisfaction: evaluation.helpfulness,
          weight: 1.0
        };
      } else {
        // Update existing pattern
        pattern.usageCount++;
        pattern.successRate = (pattern.successRate + evaluation.overallScore) / 2;
        pattern.extractionAccuracy = (pattern.extractionAccuracy + evaluation.accuracy) / 2;
        pattern.userSatisfaction = (pattern.userSatisfaction + evaluation.helpfulness) / 2;
        pattern.lastUsed = new Date();
        pattern.weight = Math.min(pattern.weight + 0.1, 2.0); // Cap at 2.0
      }
      
      this.patterns.set(patternId, pattern);
    }
  }

  private updateUserPreferences(
    session: ConversationSession,
    criteria: SearchCriteria,
    feedback?: { selectedProperties?: Property[]; wasHelpful?: boolean }
  ): void {
    const userId = session.id; // Using session ID as user ID for now
    
    let profile = this.userProfiles.get(userId);
    if (!profile) {
      profile = this.createNewUserProfile(userId);
    }

    // Update property type preferences
    if (criteria.propertyType && criteria.propertyType !== 'any') {
      profile.preferredPropertyTypes[criteria.propertyType] = 
        (profile.preferredPropertyTypes[criteria.propertyType] || 0) + 1;
    }

    // Update price range patterns
    if (criteria.minPrice || criteria.maxPrice) {
      const existingRange = profile.priceRangePatterns.find(
        r => r.min === criteria.minPrice && r.max === criteria.maxPrice
      );
      
      if (existingRange) {
        existingRange.frequency++;
      } else {
        profile.priceRangePatterns.push({
          min: criteria.minPrice,
          max: criteria.maxPrice,
          frequency: 1
        });
      }
    }

    // Update feature preferences
    criteria.features?.forEach(feature => {
      profile.featurePreferences[feature] = 
        (profile.featurePreferences[feature] || 0) + 1;
    });

    // Update from user feedback
    if (feedback?.selectedProperties) {
      feedback.selectedProperties.forEach(property => {
        // Boost preferences for selected property characteristics
        profile.preferredPropertyTypes[property.propertyType] = 
          (profile.preferredPropertyTypes[property.propertyType] || 0) + 2;
        
        property.features.forEach(feature => {
          profile.featurePreferences[feature] = 
            (profile.featurePreferences[feature] || 0) + 1;
        });
      });
    }

    profile.lastUpdated = new Date();
    this.userProfiles.set(userId, profile);
  }

  private updateExtractionPatterns(
    evaluation: ConversationEvaluation,
    session: ConversationSession,
    criteria?: SearchCriteria
  ): void {
    // Learn from extraction accuracy
    if (evaluation.accuracy > 0.8 && criteria) {
      const extractionPattern = this.extractSuccessfulExtractionPattern(session, criteria);
      // Store successful patterns for future use
      // This would be used to improve the extraction prompts
    }
  }

  private updateConversationStyle(
    evaluation: ConversationEvaluation,
    session: ConversationSession
  ): void {
    const userId = session.id;
    let profile = this.userProfiles.get(userId) || this.createNewUserProfile(userId);

    // Analyze message patterns
    const userMessages = session.messages.filter(m => m.role === 'user');
    const avgResponseLength = userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length;
    
    // Update conversation style preferences
    if (evaluation.helpfulness > 0.8) {
      profile.conversationStyle.respondsWellToSuggestions = true;
    }
    
    if (userMessages.length > 5) {
      profile.conversationStyle.needsMoreGuidance = true;
    }
    
    if (avgResponseLength > 100) {
      profile.conversationStyle.prefersDetailedQuestions = true;
    }

    this.userProfiles.set(userId, profile);
  }

  private extractConversationFlow(session: ConversationSession): string {
    // Simplified conversation flow extraction
    const messages = session.messages;
    const flow = [];
    
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      if (message.role === 'assistant') {
        if (message.content.includes('?')) {
          flow.push('question');
        } else if (message.content.includes('READY_TO_SEARCH')) {
          flow.push('search');
        } else {
          flow.push('response');
        }
      }
    }
    
    return flow.join('-');
  }

  private generatePatternId(flow: string): string {
    return `pattern_${flow.replace(/-/g, '_')}`;
  }

  private createNewUserProfile(userId: string): UserLearningProfile {
    return {
      userId,
      preferredPropertyTypes: {},
      priceRangePatterns: [],
      featurePreferences: {},
      conversationStyle: {
        prefersDetailedQuestions: false,
        respondsWellToSuggestions: false,
        needsMoreGuidance: false,
        averageResponseTime: 0
      },
      searchPatterns: {
        typicalSearchSequence: [],
        refinementFrequency: 0,
        exportPreferences: {}
      },
      lastUpdated: new Date()
    };
  }

  private getMostPreferredPropertyType(profile: UserLearningProfile): string | null {
    const types = Object.entries(profile.preferredPropertyTypes);
    if (types.length === 0) return null;
    
    return types.reduce((a, b) => a[1] > b[1] ? a : b)[0];
  }

  private getSuggestedFeatures(profile: UserLearningProfile, criteria: SearchCriteria): string[] {
    const suggested = [];
    const sortedFeatures = Object.entries(profile.featurePreferences)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3); // Top 3 features
    
    for (const [feature, weight] of sortedFeatures) {
      if (weight > 1 && !criteria.features?.includes(feature)) {
        suggested.push(feature);
      }
    }
    
    return suggested;
  }

  private getOptimizedPriceRange(
    profile: UserLearningProfile, 
    criteria: SearchCriteria
  ): { min?: number; max?: number } | null {
    if (criteria.minPrice || criteria.maxPrice) return null;
    
    const ranges = profile.priceRangePatterns
      .sort((a, b) => b.frequency - a.frequency);
    
    return ranges.length > 0 ? ranges[0] : null;
  }

  private extractSuccessfulExtractionPattern(
    session: ConversationSession,
    criteria: SearchCriteria
  ): any {
    // Extract patterns that led to successful criteria extraction
    return {
      messageCount: session.messages.length,
      criteriaFields: Object.keys(criteria).filter(k => (criteria as any)[k] !== undefined),
      lastUserMessage: session.messages.filter(m => m.role === 'user').pop()?.content
    };
  }

  private loadLearningData(): void {
    try {
      if (existsSync(this.learningDataPath)) {
        const data = JSON.parse(readFileSync(this.learningDataPath, 'utf8'));
        
        if (data.patterns) {
          this.patterns = new Map(Object.entries(data.patterns));
        }
        
        if (data.userProfiles) {
          this.userProfiles = new Map(Object.entries(data.userProfiles));
        }
        
        console.log(chalk.gray(`📚 Loaded learning data: ${this.patterns.size} patterns, ${this.userProfiles.size} profiles`));
      }
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not load learning data, starting fresh'));
    }
  }

  private saveLearningData(): void {
    try {
      const data = {
        patterns: Object.fromEntries(this.patterns),
        userProfiles: Object.fromEntries(this.userProfiles),
        lastUpdated: new Date().toISOString()
      };
      
      writeFileSync(this.learningDataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.warn(chalk.yellow('⚠️  Could not save learning data'));
    }
  }

  // Public methods for getting insights
  getLearningStats() {
    return {
      totalPatterns: this.patterns.size,
      totalUserProfiles: this.userProfiles.size,
      avgPatternSuccessRate: Array.from(this.patterns.values())
        .reduce((sum, p) => sum + p.successRate, 0) / this.patterns.size || 0
    };
  }
} 