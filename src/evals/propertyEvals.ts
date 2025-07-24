import { Property, SearchCriteria } from '../types/property';

export interface PropertySearchEvaluation {
  relevance: number; // 0-1: How relevant are the results to search criteria
  diversity: number; // 0-1: How diverse are the property types/price ranges
  completeness: number; // 0-1: How complete is the property data
  freshness: number; // 0-1: How recent are the listings
  rankingAccuracy: number; // 0-1: How well are properties ranked
  overallScore: number;
}

export interface RankingEvaluation {
  topResultRelevance: number; // How relevant is the #1 result
  rankingConsistency: number; // How consistent is the ranking algorithm
  priceRankingAccuracy: number; // How well does price ranking work
  featureMatchAccuracy: number; // How well does feature matching work
}

export interface ApiPerformanceEvaluation {
  responseTime: number; // milliseconds
  successRate: number; // 0-1
  dataQuality: number; // 0-1: How complete/accurate is the returned data
  errorRate: number; // 0-1
  availabilityScore: number; // 0-1
}

export class PropertyEvaluator {
  private searchEvaluations: PropertySearchEvaluation[] = [];
  private apiMetrics: Map<string, ApiPerformanceEvaluation[]> = new Map();

  evaluateSearchResults(
    properties: Property[], 
    criteria: SearchCriteria,
    searchTime: number
  ): PropertySearchEvaluation {
    const relevance = this.calculateRelevance(properties, criteria);
    const diversity = this.calculateDiversity(properties);
    const completeness = this.calculateCompleteness(properties);
    const freshness = this.calculateFreshness(properties);
    const rankingAccuracy = this.evaluateRanking(properties, criteria);
    
    const overallScore = (relevance + diversity + completeness + freshness + rankingAccuracy) / 5;
    
    const evaluation: PropertySearchEvaluation = {
      relevance,
      diversity,
      completeness,
      freshness,
      rankingAccuracy,
      overallScore
    };
    
    this.searchEvaluations.push(evaluation);
    return evaluation;
  }

  private calculateRelevance(properties: Property[], criteria: SearchCriteria): number {
    if (properties.length === 0) return 0;
    
    let relevantCount = 0;
    
    properties.forEach(property => {
      let isRelevant = true;
      
      // Check price range compliance
      if (criteria.minPrice && property.price < criteria.minPrice) isRelevant = false;
      if (criteria.maxPrice && property.price > criteria.maxPrice) isRelevant = false;
      
      // Check bedroom/bathroom requirements
      if (criteria.bedrooms && property.bedrooms < criteria.bedrooms) isRelevant = false;
      if (criteria.bathrooms && property.bathrooms < criteria.bathrooms) isRelevant = false;
      
      // Check property type
      if (criteria.propertyType !== 'any' && property.propertyType !== criteria.propertyType) {
        isRelevant = false;
      }
      
      // Check location (basic check for city match)
      if (!property.city.toLowerCase().includes(criteria.city.toLowerCase())) {
        isRelevant = false;
      }
      
      if (isRelevant) relevantCount++;
    });
    
    return relevantCount / properties.length;
  }

  private calculateDiversity(properties: Property[]): number {
    if (properties.length === 0) return 0;
    
    const propertyTypes = new Set(properties.map(p => p.propertyType));
    const priceRanges = this.getPriceRanges(properties);
    const sources = new Set(properties.map(p => p.source));
    const bedroomVariety = new Set(properties.map(p => p.bedrooms));
    const featureVariety = this.calculateFeatureVariety(properties);
    
    // Enhanced diversity scoring with more factors
    const typeScore = Math.min(propertyTypes.size / 4, 1); // Max 4 types
    const priceScore = Math.min(priceRanges / 4, 1); // Max 4 price ranges  
    const sourceScore = Math.min(sources.size / 3, 1); // Max 3 sources
    const bedroomScore = Math.min(bedroomVariety.size / 5, 1); // Max 5 bedroom counts
    const featureScore = Math.min(featureVariety / 10, 1); // Max 10 unique features
    
    // Weighted average - price and bedroom diversity are most important for user experience
    return (typeScore * 0.25 + priceScore * 0.3 + sourceScore * 0.15 + bedroomScore * 0.2 + featureScore * 0.1);
  }

  private calculateFeatureVariety(properties: Property[]): number {
    const allFeatures = new Set();
    properties.forEach(property => {
      property.features.forEach(feature => allFeatures.add(feature));
    });
    return allFeatures.size;
  }

  private getPriceRanges(properties: Property[]): number {
    const prices = properties.map(p => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min;
    
    if (range === 0) return 1;
    
    // Create price buckets and count how many are represented
    const buckets = 4; // Budget, Affordable, Premium, Luxury
    const bucketSize = range / buckets;
    const representedBuckets = new Set();
    
    prices.forEach(price => {
      const bucketIndex = Math.min(Math.floor((price - min) / bucketSize), buckets - 1);
      representedBuckets.add(bucketIndex);
    });
    
    return representedBuckets.size;
  }

  private calculateCompleteness(properties: Property[]): number {
    if (properties.length === 0) return 0;
    
    const requiredFields = ['address', 'price', 'bedrooms', 'bathrooms', 'propertyType'];
    const optionalFields = ['squareFootage', 'description', 'features', 'imageUrls'];
    
    let totalScore = 0;
    
    properties.forEach(property => {
      let propertyScore = 0;
      
      // Check required fields (weight: 2)
      requiredFields.forEach(field => {
        if (property[field as keyof Property] && property[field as keyof Property] !== '') {
          propertyScore += 2;
        }
      });
      
      // Check optional fields (weight: 1)
      optionalFields.forEach(field => {
        const value = property[field as keyof Property];
        if (value && (Array.isArray(value) ? value.length > 0 : value !== '')) {
          propertyScore += 1;
        }
      });
      
      totalScore += propertyScore / (requiredFields.length * 2 + optionalFields.length);
    });
    
    return totalScore / properties.length;
  }

  private calculateFreshness(properties: Property[]): number {
    if (properties.length === 0) return 0;
    
    const now = Date.now();
    let totalFreshness = 0;
    
    properties.forEach(property => {
      const ageInDays = (now - property.dateAdded.getTime()) / (1000 * 60 * 60 * 24);
      let freshness = 1;
      
      if (ageInDays > 30) freshness = 0.3;
      else if (ageInDays > 14) freshness = 0.6;
      else if (ageInDays > 7) freshness = 0.8;
      
      totalFreshness += freshness;
    });
    
    return totalFreshness / properties.length;
  }

  private evaluateRanking(properties: Property[], criteria: SearchCriteria): number {
    if (properties.length < 2) return 1;
    
    let correctPairs = 0;
    let totalPairs = 0;
    
    // Check if ranking follows expected patterns
    for (let i = 0; i < properties.length - 1; i++) {
      for (let j = i + 1; j < Math.min(i + 5, properties.length); j++) {
        const prop1 = properties[i];
        const prop2 = properties[j];
        
        // Higher ranked should have higher or equal score
        if (prop1.score !== undefined && prop2.score !== undefined) {
          if (prop1.score >= prop2.score) {
            correctPairs++;
          }
          totalPairs++;
        }
      }
    }
    
    return totalPairs > 0 ? correctPairs / totalPairs : 1;
  }

  // API Performance Tracking
  trackApiPerformance(
    apiName: string, 
    responseTime: number, 
    success: boolean, 
    dataQuality: number = 1
  ): void {
    if (!this.apiMetrics.has(apiName)) {
      this.apiMetrics.set(apiName, []);
    }
    
    const metrics = this.apiMetrics.get(apiName)!;
    metrics.push({
      responseTime,
      successRate: success ? 1 : 0,
      dataQuality,
      errorRate: success ? 0 : 1,
      availabilityScore: success ? 1 : 0
    });
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  getApiPerformanceStats(apiName: string): ApiPerformanceEvaluation | null {
    const metrics = this.apiMetrics.get(apiName);
    if (!metrics || metrics.length === 0) return null;
    
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    
    return {
      responseTime: avg(metrics.map(m => m.responseTime)),
      successRate: avg(metrics.map(m => m.successRate)),
      dataQuality: avg(metrics.map(m => m.dataQuality)),
      errorRate: avg(metrics.map(m => m.errorRate)),
      availabilityScore: avg(metrics.map(m => m.availabilityScore))
    };
  }

  // Benchmark different search criteria
  async runSearchBenchmarks(): Promise<void> {
    console.log('🏠 Running Property Search Benchmarks...\n');
    
    const benchmarkCriteria = [
      {
        name: 'High-end Columbus Houses',
        criteria: {
          city: 'Columbus',
          state: 'OH',
          listingType: 'buy' as any,
          minPrice: 400000,
          maxPrice: 800000,
          propertyType: 'house' as any,
          bedrooms: 3,
          bathrooms: 2,
          features: ['garage', 'pool']
        }
      },
      {
        name: 'Budget Apartments',
        criteria: {
          city: 'Columbus',
          state: 'OH',
          listingType: 'rent' as any,
          maxPrice: 1500,
          propertyType: 'apartment' as any,
          bedrooms: 2,
          features: ['pet-friendly']
        }
      },
      {
        name: 'Family Homes',
        criteria: {
          city: 'Columbus',
          state: 'OH',
          listingType: 'buy' as any,
          minPrice: 200000,
          maxPrice: 450000,
          propertyType: 'house' as any,
          bedrooms: 4,
          bathrooms: 2,
          features: ['garage', 'garden']
        }
      }
    ];
    
    for (const benchmark of benchmarkCriteria) {
      console.log(`Testing: ${benchmark.name}`);
      
      // Mock search results for demonstration
      const mockResults = this.generateMockResults(benchmark.criteria, 10);
      const evaluation = this.evaluateSearchResults(mockResults, benchmark.criteria, 1200);
      
      console.log(`  Relevance: ${(evaluation.relevance * 100).toFixed(1)}%`);
      console.log(`  Diversity: ${(evaluation.diversity * 100).toFixed(1)}%`);
      console.log(`  Overall: ${(evaluation.overallScore * 100).toFixed(1)}%\n`);
    }
    
    this.generateBenchmarkReport();
  }

  private generateMockResults(criteria: any, count: number): Property[] {
    // Generate realistic mock results based on criteria
    return Array.from({ length: count }, (_, i) => ({
      id: `mock-${i}`,
      address: `${1000 + i} Test St`,
      city: criteria.city,
      state: criteria.state || 'OH',
      zipCode: '43215',
      listingType: criteria.listingType,
      price: criteria.minPrice ? 
        criteria.minPrice + Math.random() * (criteria.maxPrice - criteria.minPrice) :
        criteria.maxPrice || 300000,
      bedrooms: criteria.bedrooms || 3,
      bathrooms: criteria.bathrooms || 2,
      squareFootage: 1500 + Math.random() * 1000,
      propertyType: criteria.propertyType,
      description: `Mock property ${i}`,
      features: criteria.features || [],
      imageUrls: [],
      listingUrl: `https://example.com/property-${i}`,
      source: 'Mock',
      dateAdded: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      score: 50 + Math.random() * 50
    }));
  }

  private generateBenchmarkReport(): void {
    if (this.searchEvaluations.length === 0) return;
    
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const recent = this.searchEvaluations.slice(-3); // Last 3 evaluations
    
    console.log('📊 Search Performance Report:');
    console.log(`Average Relevance: ${(avg(recent.map(e => e.relevance)) * 100).toFixed(1)}%`);
    console.log(`Average Diversity: ${(avg(recent.map(e => e.diversity)) * 100).toFixed(1)}%`);
    console.log(`Average Overall Score: ${(avg(recent.map(e => e.overallScore)) * 100).toFixed(1)}%`);
  }

  getSearchPerformanceStats() {
    if (this.searchEvaluations.length === 0) return null;
    
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    
    return {
      totalSearches: this.searchEvaluations.length,
      averageScores: {
        relevance: avg(this.searchEvaluations.map(e => e.relevance)),
        diversity: avg(this.searchEvaluations.map(e => e.diversity)),
        completeness: avg(this.searchEvaluations.map(e => e.completeness)),
        freshness: avg(this.searchEvaluations.map(e => e.freshness)),
        rankingAccuracy: avg(this.searchEvaluations.map(e => e.rankingAccuracy)),
        overall: avg(this.searchEvaluations.map(e => e.overallScore))
      }
    };
  }
} 