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

    // Price scoring (closer to middle of range gets higher score)
    if (criteria.minPrice && criteria.maxPrice) {
      const midPrice = (criteria.minPrice + criteria.maxPrice) / 2;
      const priceDistance = Math.abs(property.price - midPrice);
      const maxDistance = Math.max(midPrice - criteria.minPrice, criteria.maxPrice - midPrice);
      score += (1 - priceDistance / maxDistance) * 20;
    }

    // Feature matching
    const matchingFeatures = property.features.filter(feature => 
      criteria.features.includes(feature)
    );
    score += (matchingFeatures.length / Math.max(criteria.features.length, 1)) * 20;

    // Bedroom/bathroom bonus
    if (criteria.bedrooms && property.bedrooms >= criteria.bedrooms) {
      score += 5;
    }
    if (criteria.bathrooms && property.bathrooms >= criteria.bathrooms) {
      score += 5;
    }

    // Recency bonus (newer listings get higher score)
    const daysSinceAdded = (Date.now() - property.dateAdded.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceAdded < 7) score += 10;
    else if (daysSinceAdded < 30) score += 5;

    return Math.round(score);
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

      // Property type filter
      if (criteria.propertyType !== 'any' && property.propertyType !== criteria.propertyType) {
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

    return diversified;
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