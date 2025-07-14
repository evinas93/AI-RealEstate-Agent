import { uniqBy, orderBy } from 'lodash';
import { Property, SearchCriteria } from '../types/property';

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

    return ranked;
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
}