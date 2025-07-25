import { Property, SearchCriteria, PropertyType, ListingType } from '../types/property';
import { UserLearningProfile } from './learningEngine';
import { PropertyService } from '../services/propertyService';
import chalk from 'chalk';

export interface ProactiveSuggestion {
  id: string;
  type: 'neighborhood' | 'property_type' | 'price_adjustment' | 'feature' | 'timing' | 'alternative';
  title: string;
  description: string;
  reasoning: string;
  confidence: number; // 0-1
  priority: 'low' | 'medium' | 'high';
  actionable: boolean;
  data?: any;
  suggestedCriteria?: Partial<SearchCriteria>;
}

export interface MarketInsight {
  type: 'price_trend' | 'inventory' | 'seasonal' | 'opportunity';
  message: string;
  impact: 'positive' | 'negative' | 'neutral';
  confidence: number;
  timeframe: string;
}

export class ProactiveSuggestionEngine {
  private propertyService: PropertyService;
  private recentSearches: Map<string, SearchCriteria[]> = new Map();
  private marketData: Map<string, any> = new Map(); // Simulated market data

  constructor() {
    this.propertyService = new PropertyService();
    this.initializeMarketData();
  }

  /**
   * Generate proactive suggestions based on user profile and current search
   */
  async generateSuggestions(
    currentCriteria: SearchCriteria,
    currentResults: Property[],
    userProfile?: UserLearningProfile,
    userId?: string
  ): Promise<ProactiveSuggestion[]> {
    console.log(chalk.blue('\n🎯 Generating proactive suggestions...'));

    const suggestions: ProactiveSuggestion[] = [];

    // 1. Alternative neighborhoods
    suggestions.push(...await this.suggestAlternativeNeighborhoods(currentCriteria, currentResults));

    // 2. Property type suggestions
    suggestions.push(...this.suggestPropertyTypes(currentCriteria, userProfile));

    // 3. Price optimization suggestions
    suggestions.push(...this.suggestPriceOptimizations(currentCriteria, currentResults));

    // 4. Feature recommendations
    suggestions.push(...this.suggestFeatures(currentCriteria, currentResults, userProfile));

    // 5. Timing suggestions
    suggestions.push(...this.suggestOptimalTiming(currentCriteria));

    // 6. Alternative search strategies
    suggestions.push(...this.suggestAlternativeStrategies(currentCriteria, userProfile));

    // Sort by priority and confidence
    const prioritized = suggestions
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        return priorityDiff !== 0 ? priorityDiff : b.confidence - a.confidence;
      })
      .slice(0, 6); // Top 6 suggestions

    console.log(chalk.green(`✅ Generated ${prioritized.length} proactive suggestions`));
    return prioritized;
  }

  /**
   * Generate market insights for the current search
   */
  generateMarketInsights(criteria: SearchCriteria, results: Property[]): MarketInsight[] {
    const insights: MarketInsight[] = [];

    // Price trend insights
    if (results.length > 5) {
      const avgPrice = results.reduce((sum, p) => sum + p.price, 0) / results.length;
      const marketData = this.getMarketData(criteria.city);
      
      if (marketData) {
        const trendDirection = avgPrice > marketData.avgPrice ? 'above' : 'below';
        insights.push({
          type: 'price_trend',
          message: `Current search results are ${trendDirection} market average (${marketData.avgPrice.toLocaleString()})`,
          impact: trendDirection === 'below' ? 'positive' : 'negative',
          confidence: 0.8,
          timeframe: 'current'
        });
      }
    }

    // Inventory insights
    if (results.length < 5) {
      insights.push({
        type: 'inventory',
        message: 'Limited inventory in this area - consider expanding search criteria',
        impact: 'negative',
        confidence: 0.9,
        timeframe: 'current'
      });
    } else if (results.length > 20) {
      insights.push({
        type: 'inventory',
        message: 'High inventory available - good time for selective searching',
        impact: 'positive',
        confidence: 0.8,
        timeframe: 'current'
      });
    }

    // Seasonal insights
    const month = new Date().getMonth();
    if (month >= 3 && month <= 8) { // Spring/Summer
      insights.push({
        type: 'seasonal',
        message: 'Peak buying season - more inventory but higher competition',
        impact: 'neutral',
        confidence: 0.7,
        timeframe: 'seasonal'
      });
    } else {
      insights.push({
        type: 'seasonal',
        message: 'Off-season timing may offer better negotiation opportunities',
        impact: 'positive',
        confidence: 0.6,
        timeframe: 'seasonal'
      });
    }

    return insights;
  }

  /**
   * Generate contextual follow-up questions
   */
  generateFollowUpQuestions(
    criteria: SearchCriteria,
    results: Property[],
    userProfile?: UserLearningProfile
  ): string[] {
    const questions: string[] = [];

    // Based on search results
    if (results.length === 0) {
      questions.push("Would you like me to expand the search area or adjust the price range?");
      questions.push("Are there specific features that are absolute must-haves vs nice-to-haves?");
    } else if (results.length > 15) {
      questions.push("Would you like me to help narrow down these results with additional criteria?");
      questions.push("Are there any deal-breakers I should know about to filter these options?");
    }

    // Based on criteria gaps
    if (!criteria.features || criteria.features.length === 0) {
      questions.push("Are there any specific amenities that are important to you?");
    }

    if (!criteria.maxPrice && criteria.listingType === ListingType.BUY) {
      questions.push("What's your comfortable budget range for this purchase?");
    }

    // Based on user profile
    if (userProfile?.conversationStyle.prefersDetailedQuestions) {
      questions.push("Would you like me to analyze the neighborhood characteristics of these properties?");
      questions.push("Should I provide investment potential analysis for these properties?");
    }

    return questions.slice(0, 3); // Max 3 questions
  }

  /**
   * Record user search for pattern analysis
   */
  recordSearch(userId: string, criteria: SearchCriteria): void {
    const userSearches = this.recentSearches.get(userId) || [];
    userSearches.push(criteria);
    
    // Keep only recent searches
    if (userSearches.length > 10) {
      userSearches.shift();
    }
    
    this.recentSearches.set(userId, userSearches);
  }

  private async suggestAlternativeNeighborhoods(
    criteria: SearchCriteria,
    results: Property[]
  ): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];

    // If few results, suggest expanding area
    if (results.length < 5) {
      const similarCities = this.getSimilarCities(criteria.city);
      
      for (const city of similarCities.slice(0, 2)) {
        suggestions.push({
          id: `neighborhood_${city.toLowerCase()}`,
          type: 'neighborhood',
          title: `Consider ${city}`,
          description: `Similar properties available in ${city} with ${city === 'Dublin' ? 'excellent schools' : 'growing market'}`,
          reasoning: `Limited inventory in ${criteria.city}, but ${city} offers similar amenities`,
          confidence: 0.7,
          priority: 'medium',
          actionable: true,
          suggestedCriteria: { ...criteria, city }
        });
      }
    }

    return suggestions;
  }

  private suggestPropertyTypes(
    criteria: SearchCriteria,
    userProfile?: UserLearningProfile
  ): ProactiveSuggestion[] {
    const suggestions: ProactiveSuggestion[] = [];

    // If searching for 'any', suggest most preferred from profile
    if (criteria.propertyType === PropertyType.ANY && userProfile) {
      const preferredTypes = Object.entries(userProfile.preferredPropertyTypes)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 2);

      for (const [type, count] of preferredTypes) {
        if (count > 1) {
          suggestions.push({
            id: `type_${type}`,
            type: 'property_type',
            title: `Focus on ${type}s`,
            description: `Based on your search history, you seem to prefer ${type} properties`,
            reasoning: `You've searched for ${type}s ${count} times previously`,
            confidence: Math.min(count / 5, 0.9),
            priority: 'medium',
            actionable: true,
            suggestedCriteria: { ...criteria, propertyType: type as PropertyType }
          });
        }
      }
    }

    // Suggest alternatives based on market availability
    if (criteria.propertyType === PropertyType.HOUSE && userProfile) {
      suggestions.push({
        id: 'type_townhouse_alternative',
        type: 'property_type',
        title: 'Consider townhouses',
        description: 'Townhouses often offer similar space to houses at better prices',
        reasoning: 'Market analysis shows townhouses have 15% better value in this area',
        confidence: 0.6,
        priority: 'low',
        actionable: true,
        suggestedCriteria: { ...criteria, propertyType: PropertyType.TOWNHOUSE }
      });
    }

    return suggestions;
  }

  private suggestPriceOptimizations(
    criteria: SearchCriteria,
    results: Property[]
  ): ProactiveSuggestion[] {
    const suggestions: ProactiveSuggestion[] = [];

    if (results.length > 0) {
      const prices = results.map(p => p.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

      // Suggest price range optimization
      if (!criteria.minPrice && !criteria.maxPrice) {
        const suggestedMax = Math.round(avgPrice * 1.1);
        suggestions.push({
          id: 'price_focus',
          type: 'price_adjustment',
          title: 'Set price focus',
          description: `Consider setting a budget around $${suggestedMax.toLocaleString()} based on current results`,
          reasoning: `Average price in your search is $${Math.round(avgPrice).toLocaleString()}`,
          confidence: 0.8,
          priority: 'medium',
          actionable: true,
          suggestedCriteria: { ...criteria, maxPrice: suggestedMax }
        });
      }

      // Suggest expanding budget if few results
      if (results.length < 5 && criteria.maxPrice) {
        const suggestedMax = Math.round(criteria.maxPrice * 1.15);
        suggestions.push({
          id: 'price_expand',
          type: 'price_adjustment',
          title: 'Consider expanding budget',
          description: `Increasing budget to $${suggestedMax.toLocaleString()} could show ${Math.round(results.length * 2.5)} more properties`,
          reasoning: 'Limited inventory at current price point',
          confidence: 0.7,
          priority: 'medium',
          actionable: true,
          suggestedCriteria: { ...criteria, maxPrice: suggestedMax }
        });
      }
    }

    return suggestions;
  }

  private suggestFeatures(
    criteria: SearchCriteria,
    results: Property[],
    userProfile?: UserLearningProfile
  ): ProactiveSuggestion[] {
    const suggestions: ProactiveSuggestion[] = [];

    // Suggest popular features from user profile
    if (userProfile && Object.keys(userProfile.featurePreferences).length > 0) {
      const topFeatures = Object.entries(userProfile.featurePreferences)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3);

      for (const [feature, count] of topFeatures) {
        if (!criteria.features?.includes(feature) && count > 1) {
          suggestions.push({
            id: `feature_${feature.replace(/\s+/g, '_')}`,
            type: 'feature',
            title: `Add "${feature}" requirement`,
            description: `You've shown interest in properties with ${feature} in past searches`,
            reasoning: `Feature appeared in ${count} of your previous searches`,
            confidence: Math.min(count / 3, 0.8),
            priority: 'low',
            actionable: true,
            suggestedCriteria: { 
              ...criteria, 
              features: [...(criteria.features || []), feature] 
            }
          });
        }
      }
    }

    // Suggest common features from current results
    if (results.length > 3) {
      const featureCounts: Record<string, number> = {};
      results.forEach(property => {
        property.features.forEach(feature => {
          featureCounts[feature] = (featureCounts[feature] || 0) + 1;
        });
      });

      const commonFeatures = Object.entries(featureCounts)
        .filter(([feature, count]) => count >= results.length * 0.6) // 60% of properties have it
        .sort(([,a], [,b]) => b - a)
        .slice(0, 2);

      for (const [feature, count] of commonFeatures) {
        if (!criteria.features?.includes(feature)) {
          suggestions.push({
            id: `common_feature_${feature.replace(/\s+/g, '_')}`,
            type: 'feature',
            title: `"${feature}" is common here`,
            description: `${Math.round((count / results.length) * 100)}% of properties in this area include ${feature}`,
            reasoning: 'Area characteristic that might interest you',
            confidence: 0.6,
            priority: 'low',
            actionable: false
          });
        }
      }
    }

    return suggestions;
  }

  private suggestOptimalTiming(criteria: SearchCriteria): ProactiveSuggestion[] {
    const suggestions: ProactiveSuggestion[] = [];
    const month = new Date().getMonth();
    const isRental = criteria.listingType === ListingType.RENT;

    // Seasonal timing suggestions
    if (isRental) {
      if (month >= 7 && month <= 9) { // Aug-Oct
        suggestions.push({
          id: 'timing_rental_peak',
          type: 'timing',
          title: 'Peak rental season',
          description: 'August-October is peak rental season with highest inventory',
          reasoning: 'Academic calendar drives rental market timing',
          confidence: 0.9,
          priority: 'low',
          actionable: false
        });
      } else if (month >= 11 || month <= 2) { // Nov-Feb
        suggestions.push({
          id: 'timing_rental_deals',
          type: 'timing',
          title: 'Off-season rental opportunities',
          description: 'Winter months often have better rental deals and more negotiation room',
          reasoning: 'Lower demand period for rentals',
          confidence: 0.7,
          priority: 'medium',
          actionable: false
        });
      }
    } else {
      if (month >= 3 && month <= 6) { // Apr-Jul
        suggestions.push({
          id: 'timing_buying_peak',
          type: 'timing',
          title: 'Peak buying season',
          description: 'Spring/summer offers most inventory but highest competition',
          reasoning: 'Traditional peak home buying season',
          confidence: 0.8,
          priority: 'low',
          actionable: false
        });
      }
    }

    return suggestions;
  }

  private suggestAlternativeStrategies(
    criteria: SearchCriteria,
    userProfile?: UserLearningProfile
  ): ProactiveSuggestion[] {
    const suggestions: ProactiveSuggestion[] = [];

    // Multi-step search strategy
    if (criteria.bedrooms && criteria.bedrooms >= 3) {
      suggestions.push({
        id: 'strategy_flexible_bedrooms',
        type: 'alternative',
        title: 'Consider flexible bedroom count',
        description: 'Searching for both 2 and 3 bedrooms could reveal more options',
        reasoning: 'Den/office spaces can often serve as additional bedrooms',
        confidence: 0.6,
        priority: 'low',
        actionable: true,
        suggestedCriteria: { ...criteria, bedrooms: criteria.bedrooms - 1 }
      });
    }

    // Investment strategy
    if (criteria.listingType === ListingType.BUY && criteria.maxPrice && criteria.maxPrice > 200000) {
      suggestions.push({
        id: 'strategy_investment',
        type: 'alternative',
        title: 'Consider investment potential',
        description: 'Properties in this range often have good rental investment potential',
        reasoning: 'Price point aligns with rental market demand',
        confidence: 0.5,
        priority: 'low',
        actionable: false
      });
    }

    return suggestions;
  }

  private getSimilarCities(city: string): string[] {
    // Simplified city similarity mapping
    const similarCities: Record<string, string[]> = {
      'columbus': ['Dublin', 'Westerville', 'Gahanna', 'Upper Arlington'],
      'dublin': ['Columbus', 'Worthington', 'Powell'],
      'chicago': ['Evanston', 'Oak Park', 'Naperville'],
      'austin': ['Round Rock', 'Cedar Park', 'Pflugerville'],
      'default': ['Nearby Area 1', 'Nearby Area 2']
    };

    return similarCities[city.toLowerCase()] || similarCities['default'];
  }

  private getMarketData(city: string): any {
    // Simplified market data - in production this would come from real market APIs
    return this.marketData.get(city.toLowerCase()) || {
      avgPrice: 350000,
      priceGrowth: 0.05,
      inventory: 'medium',
      daysOnMarket: 45
    };
  }

  private initializeMarketData(): void {
    // Initialize with some sample market data
    this.marketData.set('columbus', {
      avgPrice: 280000,
      priceGrowth: 0.07,
      inventory: 'high',
      daysOnMarket: 35
    });

    this.marketData.set('dublin', {
      avgPrice: 450000,
      priceGrowth: 0.04,
      inventory: 'medium',
      daysOnMarket: 28
    });

    this.marketData.set('chicago', {
      avgPrice: 380000,
      priceGrowth: 0.03,
      inventory: 'low',
      daysOnMarket: 42
    });
  }

  // Analytics methods
  getSuggestionStats() {
    return {
      totalSearchesTracked: Array.from(this.recentSearches.values())
        .reduce((sum, searches) => sum + searches.length, 0),
      uniqueUsers: this.recentSearches.size,
      avgSearchesPerUser: this.recentSearches.size > 0 
        ? Array.from(this.recentSearches.values())
            .reduce((sum, searches) => sum + searches.length, 0) / this.recentSearches.size 
        : 0
    };
  }
} 