import { uniqBy, orderBy } from 'lodash';
import { Property, SearchCriteria, PropertyType } from '../types/property';

export class PropertyService {
  deduplicateProperties(properties: Property[]): Property[] {
    // Remove duplicates based on address and price
    return uniqBy(properties, (property) => 
      `${property.address.toLowerCase()}-${property.price}`
    );
  }

  rankProperties(properties: Property[], criteria: SearchCriteria): Property[] {
    // Calculate score for each property
    const scoredProperties = properties.map(property => ({
      ...property,
      score: this.calculateScore(property, criteria)
    })) as Property[];

    // Sort by score (highest first), then by price (lowest first)
    return orderBy(scoredProperties, ['score', 'price'], ['desc', 'asc']);
  }

  diversifyResults(properties: Property[], criteria: SearchCriteria, maxResults: number = 15): Property[] {
    if (properties.length <= maxResults) return properties;

    const diversified: Property[] = [];
    const remaining = [...properties];
    
    // Group properties by characteristics for diversity
    const priceRanges = this.createPriceRanges(properties);
    
    // Strategy: Pick diverse properties while maintaining quality
    while (diversified.length < maxResults && remaining.length > 0) {
      let nextProperty: Property | null = null;
      
      // 1. Prioritize different price ranges
      if (diversified.length < 5) {
        nextProperty = this.selectFromUnrepresentedPriceRange(remaining, diversified, priceRanges);
      }
      
      // 2. Ensure property type variety (if search allows)
      if (!nextProperty && criteria.propertyType === 'any') {
        nextProperty = this.selectDifferentPropertyType(remaining, diversified);
      }
      
      // 3. Vary bedroom counts
      if (!nextProperty) {
        nextProperty = this.selectDifferentBedroomCount(remaining, diversified);
      }
      
      // 4. Fallback: highest scoring remaining property
      if (!nextProperty) {
        nextProperty = remaining[0];
      }
      
      if (nextProperty) {
        diversified.push(nextProperty);
        const index = remaining.indexOf(nextProperty);
        remaining.splice(index, 1);
      } else {
        break;
      }
    }
    
    return diversified;
  }

  private createPriceRanges(properties: Property[]): Array<{range: string, min: number, max: number}> {
    const prices = properties.map(p => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const rangeSize = (max - min) / 4; // Create 4 price ranges
    
    return [
      { range: 'budget', min: min, max: min + rangeSize },
      { range: 'affordable', min: min + rangeSize, max: min + 2 * rangeSize },
      { range: 'premium', min: min + 2 * rangeSize, max: min + 3 * rangeSize },
      { range: 'luxury', min: min + 3 * rangeSize, max: max }
    ];
  }

  private selectFromUnrepresentedPriceRange(
    remaining: Property[], 
    selected: Property[], 
    priceRanges: Array<{range: string, min: number, max: number}>
  ): Property | null {
    const selectedRanges = selected.map(p => {
      return priceRanges.find(range => p.price >= range.min && p.price <= range.max)?.range;
    });
    
    for (const range of priceRanges) {
      if (!selectedRanges.includes(range.range)) {
        const candidate = remaining.find(p => p.price >= range.min && p.price <= range.max);
        if (candidate) return candidate;
      }
    }
    
    return null;
  }

  private selectDifferentPropertyType(remaining: Property[], selected: Property[]): Property | null {
    const selectedTypes = new Set(selected.map(p => p.propertyType));
    
    for (const property of remaining) {
      if (!selectedTypes.has(property.propertyType)) {
        return property;
      }
    }
    
    return null;
  }

  private selectDifferentBedroomCount(remaining: Property[], selected: Property[]): Property | null {
    const selectedBedrooms = new Set(selected.map(p => p.bedrooms));
    
    for (const property of remaining) {
      if (!selectedBedrooms.has(property.bedrooms)) {
        return property;
      }
    }
    
    return null;
  }

  private calculateScore(property: Property, criteria: SearchCriteria): number {
    let score = 0;

    // Base score
    score += 50;

    // Enhanced price scoring with value assessment
    score += this.calculatePriceScore(property, criteria);

    // Feature matching with weighted importance
    score += this.calculateFeatureScore(property, criteria);

    // Property size optimization
    score += this.calculateSizeScore(property, criteria);

    // Location and commute factors
    score += this.calculateLocationScore(property, criteria);

    // Recency with enhanced freshness algorithm
    score += this.calculateFreshnessScore(property);

    // Value-to-size ratio bonus
    score += this.calculateValueScore(property);

    return Math.round(Math.min(score, 100)); // Cap at 100
  }

  private calculatePriceScore(property: Property, criteria: SearchCriteria): number {
    let priceScore = 0;

    if (criteria.minPrice && criteria.maxPrice) {
      const midPrice = (criteria.minPrice + criteria.maxPrice) / 2;
      const priceDistance = Math.abs(property.price - midPrice);
      const maxDistance = Math.max(midPrice - criteria.minPrice, criteria.maxPrice - midPrice);
      priceScore += (1 - priceDistance / maxDistance) * 25; // Increased weight
    } else if (criteria.maxPrice) {
      // Reward properties well under budget
      const utilization = property.price / criteria.maxPrice;
      if (utilization <= 0.8) priceScore += 15; // Great value
      else if (utilization <= 0.95) priceScore += 10; // Good value
      else priceScore += 5; // At budget
    }

    return priceScore;
  }

  private calculateFeatureScore(property: Property, criteria: SearchCriteria): number {
    const matchingFeatures = property.features.filter(feature => 
      criteria.features.some(requested => 
        feature.toLowerCase().includes(requested.toLowerCase()) ||
        requested.toLowerCase().includes(feature.toLowerCase())
      )
    );

    // Enhanced feature scoring with bonus for exact matches
    const baseFeatureScore = (matchingFeatures.length / Math.max(criteria.features.length, 1)) * 15;
    
    // Bonus for premium features
    const premiumFeatures = ['pool', 'gym', 'concierge', 'doorman', 'rooftop', 'garage'];
    const premiumMatches = property.features.filter(feature => 
      premiumFeatures.some(premium => feature.toLowerCase().includes(premium))
    ).length;
    
    return baseFeatureScore + (premiumMatches * 2);
  }

  private calculateSizeScore(property: Property, criteria: SearchCriteria): number {
    let sizeScore = 0;

    // Bedroom scoring with optimal range
    if (criteria.bedrooms) {
      if (property.bedrooms === criteria.bedrooms) sizeScore += 8; // Perfect match
      else if (property.bedrooms === criteria.bedrooms + 1) sizeScore += 6; // One extra
      else if (property.bedrooms > criteria.bedrooms) sizeScore += 3; // More than needed
    }

    // Bathroom scoring
    if (criteria.bathrooms) {
      if (property.bathrooms >= criteria.bathrooms) {
        const bathroomBonus = Math.min((property.bathrooms - criteria.bathrooms + 1) * 3, 8);
        sizeScore += bathroomBonus;
      }
    }

    return sizeScore;
  }

  private calculateLocationScore(property: Property, criteria: SearchCriteria): number {
    // Enhanced location scoring (can be expanded with real geolocation data)
    let locationScore = 5; // Base location score

    // Bonus for desirable zip codes (simplified - would use real data)
    const zipCode = property.zipCode;
    if (zipCode) {
      // Premium areas get bonus (this would be data-driven in production)
      const lastTwo = parseInt(zipCode.slice(-2));
      if (lastTwo < 20) locationScore += 3; // Assume lower numbers are premium areas
    }

    return locationScore;
  }

  private calculateFreshnessScore(property: Property): number {
    const daysSinceAdded = (Date.now() - property.dateAdded.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceAdded < 1) return 12; // Brand new
    if (daysSinceAdded < 3) return 10; // Very fresh
    if (daysSinceAdded < 7) return 8;  // Fresh
    if (daysSinceAdded < 14) return 6; // Recent
    if (daysSinceAdded < 30) return 4; // Moderately fresh
    if (daysSinceAdded < 60) return 2; // Older
    return 0; // Very old
  }

  private calculateValueScore(property: Property): number {
    if (!property.squareFootage || property.squareFootage === 0) return 0;

    const pricePerSqFt = property.price / property.squareFootage;
    
    // Determine if this is a good value (simplified - would use market data)
    const isRental = property.listingType === 'rent';
    const avgPricePerSqFt = isRental ? 2.0 : 150; // $2/sqft for rent, $150/sqft for buy
    
    const valueRatio = avgPricePerSqFt / pricePerSqFt;
    
    if (valueRatio > 1.2) return 8; // Excellent value
    if (valueRatio > 1.1) return 6; // Great value
    if (valueRatio > 1.0) return 4; // Good value
    if (valueRatio > 0.9) return 2; // Fair value
    return 0; // Expensive
  }

  filterProperties(properties: Property[], criteria: SearchCriteria): Property[] {
    return properties.filter(property => {
      // Price range filter
      if (criteria.minPrice && property.price < criteria.minPrice) return false;
      if (criteria.maxPrice && property.price > criteria.maxPrice) return false;

      // Bedroom filter
      if (criteria.bedrooms && property.bedrooms < criteria.bedrooms) return false;

      // Bathroom filter
      if (criteria.bathrooms && property.bathrooms < criteria.bathrooms) return false;

      // Property type filter - FIXED: Use enum comparison and add strict apartment filtering
      if (criteria.propertyType !== PropertyType.ANY && property.propertyType !== criteria.propertyType) {
        // Extra strict filtering for apartment searches
        if (criteria.propertyType === PropertyType.APARTMENT && property.propertyType === PropertyType.HOUSE) {
          console.log(`🚫 FINAL FILTER: Excluding single family house ${property.address} from apartment search`);
        }
        return false;
      }

      return true;
    });
  }

  aggregateAndProcess(properties: Property[], criteria: SearchCriteria): Property[] {
    // Filter properties based on criteria
    const filtered = this.filterProperties(properties, criteria);
    
    // Remove duplicates
    const deduplicated = this.deduplicateProperties(filtered);
    
    // Rank properties
    const ranked = this.rankProperties(deduplicated, criteria);

    // Apply diversification for better variety
    const diversified = this.diversifyResults(ranked, criteria, 15);

    // Add smart recommendations
    const withRecommendations = this.addSmartRecommendations(diversified, criteria);

    return withRecommendations;
  }

  addSmartRecommendations(properties: Property[], criteria: SearchCriteria): Property[] {
    // Add metadata for recommendations
    return properties.map(property => ({
      ...property,
      recommendations: this.generateRecommendations(property, criteria),
      marketInsights: this.generateMarketInsights(property, properties)
    }));
  }

  private generateRecommendations(property: Property, criteria: SearchCriteria): string[] {
    const recommendations: string[] = [];

    // Value recommendations
    if (property.squareFootage) {
      const pricePerSqFt = property.price / property.squareFootage;
      const isRental = property.listingType === 'rent';
      const avgPricePerSqFt = isRental ? 2.0 : 150;
      
      if (pricePerSqFt < avgPricePerSqFt * 0.9) {
        recommendations.push("💰 Excellent value - below market price per sq ft");
      }
    }

    // Size recommendations
    if (criteria.bedrooms && property.bedrooms > criteria.bedrooms) {
      recommendations.push("🛏️ Extra bedroom - great for guests or home office");
    }

    // Feature recommendations
    const premiumFeatures = property.features.filter(feature => 
      ['pool', 'gym', 'concierge', 'doorman', 'rooftop'].some(premium => 
        feature.toLowerCase().includes(premium)
      )
    );
    if (premiumFeatures.length > 0) {
      recommendations.push(`✨ Premium amenities: ${premiumFeatures.slice(0, 2).join(', ')}`);
    }

    // Freshness recommendations
    const daysSinceAdded = (Date.now() - property.dateAdded.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceAdded < 3) {
      recommendations.push("🆕 Recently listed - act fast!");
    }

    // Budget recommendations
    if (criteria.maxPrice && property.price < criteria.maxPrice * 0.85) {
      const savings = criteria.maxPrice - property.price;
      const monthlySavings = property.listingType === 'rent' ? savings : Math.round(savings / 360); // 30 year mortgage
      recommendations.push(`💵 ${monthlySavings > 0 ? `Save $${monthlySavings.toLocaleString()}${property.listingType === 'rent' ? '/month' : '/month on mortgage'}` : 'Within budget'}`);
    }

    return recommendations.slice(0, 3); // Limit to top 3 recommendations
  }

  private generateMarketInsights(property: Property, allProperties: Property[]): any {
    const similarProperties = allProperties.filter(p => 
      p.propertyType === property.propertyType &&
      Math.abs(p.bedrooms - property.bedrooms) <= 1
    );

    if (similarProperties.length < 2) return {};

    const prices = similarProperties.map(p => p.price);
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const medianPrice = prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)];

    const pricePercentile = prices.filter(p => p <= property.price).length / prices.length;

    return {
      averagePrice: Math.round(avgPrice),
      medianPrice: Math.round(medianPrice),
      pricePercentile: Math.round(pricePercentile * 100),
      totalComparables: similarProperties.length,
      pricePosition: pricePercentile < 0.25 ? 'Great Deal' : 
                    pricePercentile < 0.5 ? 'Good Value' :
                    pricePercentile < 0.75 ? 'Market Rate' : 'Premium'
    };
  }

  getSearchSummary(properties: Property[]): {
    totalCount: number;
    averagePrice: number;
    priceRange: { min: number; max: number };
    propertyTypes: Record<string, number>;
  } {
    if (properties.length === 0) {
      return {
        totalCount: 0,
        averagePrice: 0,
        priceRange: { min: 0, max: 0 },
        propertyTypes: {}
      };
    }

    const prices = properties.map(p => p.price);
    const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    const propertyTypes: Record<string, number> = {};
    properties.forEach(property => {
      propertyTypes[property.propertyType] = (propertyTypes[property.propertyType] || 0) + 1;
    });

    return {
      totalCount: properties.length,
      averagePrice: Math.round(averagePrice),
      priceRange: { min: minPrice, max: maxPrice },
      propertyTypes
    };
  }

  // New method to calculate diversity score for evaluation
  calculateDiversityScore(properties: Property[]): number {
    if (properties.length === 0) return 0;
    
    const propertyTypes = new Set(properties.map(p => p.propertyType));
    const priceRanges = this.calculatePriceRangeVariety(properties);
    const bedroomVariety = new Set(properties.map(p => p.bedrooms));
    const featureVariety = this.calculateFeatureVariety(properties);
    
    // Normalize diversity scores
    const typeScore = Math.min(propertyTypes.size / 4, 1); // Max 4 types
    const priceScore = Math.min(priceRanges / 4, 1); // Max 4 price ranges
    const bedroomScore = Math.min(bedroomVariety.size / 5, 1); // Max 5 bedroom counts
    const featureScore = Math.min(featureVariety / 10, 1); // Max 10 unique features
    
    return (typeScore + priceScore + bedroomScore + featureScore) / 4;
  }

  private calculatePriceRangeVariety(properties: Property[]): number {
    const prices = properties.map(p => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min;
    
    if (range === 0) return 1;
    if (range < 50000) return 2;
    if (range < 100000) return 3;
    return 4;
  }

  private calculateFeatureVariety(properties: Property[]): number {
    const allFeatures = new Set();
    properties.forEach(property => {
      property.features.forEach(feature => allFeatures.add(feature));
    });
    return allFeatures.size;
  }
}