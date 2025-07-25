import axios, { AxiosInstance } from 'axios';
import { SearchCriteria, Property, PropertyType, ListingType, ApiResponse } from '../types/property';
import config from '../config';
import chalk from 'chalk';

interface CacheEntry {
  data: Property[];
  timestamp: number;
  criteria: string;
}

export class RealEstateApiClient {
  private apifyClient: AxiosInstance;
  private zillowClient: AxiosInstance;
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  private readonly MAX_CACHE_SIZE = 100;

  constructor() {
    this.apifyClient = axios.create({
      baseURL: config.api.apify.baseUrl,
      timeout: config.app.apiTimeout,
      headers: {
        'Authorization': `Bearer ${config.api.apify.apiToken}`
      }
    });

    this.zillowClient = axios.create({
      baseURL: `https://${config.api.zillow.apiHost}`,
      timeout: config.app.apiTimeout,
      headers: {
        'X-RapidAPI-Key': config.api.zillow.apiKey,
        'X-RapidAPI-Host': config.api.zillow.apiHost
      }
    });
  }

  async searchProperties(criteria: SearchCriteria): Promise<Property[]> {
    // Check cache first
    const cacheKey = this.generateCacheKey(criteria);
    const cachedResult = this.getFromCache(cacheKey);
    
    if (cachedResult) {
      console.log(chalk.gray('📦 Using cached results...'));
      return cachedResult;
    }

    const results: Property[] = [];
    const hasValidApis = config.hasAnyValidApiConfig();
    const shouldUseStrictMode = config.app.strictApiMode && hasValidApis;

    // Check if we should use mock data
    if (config.app.useMockData || (!hasValidApis && !shouldUseStrictMode)) {
      if (!hasValidApis) {
        console.log(chalk.yellow('\n⚠️  No API keys configured. Using mock data.'));
        console.log(chalk.gray('To use real data, copy .env.example to .env and add your API keys.'));
        console.log(chalk.gray('Note: URLs shown are simulated but follow real listing site patterns.\n'));
      } else {
        console.log(chalk.blue('\n🔧 Mock data mode enabled (USE_MOCK_DATA=true)'));
      }
      const mockResults = this.generateMockProperties(criteria, 'MockAPI');
      this.addToCache(cacheKey, mockResults, criteria);
      return mockResults;
    }

    if (shouldUseStrictMode) {
      console.log(chalk.green('\n🔒 Strict API mode enabled - using real API data only'));
    }

    try {
      // Search multiple APIs in parallel
      const apiCalls: Promise<Property[]>[] = [];

      if (config.hasValidApifyConfig()) {
        apiCalls.push(this.searchApify(criteria));
      }

      if (config.hasValidZillowConfig()) {
        apiCalls.push(this.searchZillow(criteria));
      }

      // Add more API calls here as you implement them
      // if (config.hasValidRentberryConfig()) {
      //   apiCalls.push(this.searchRentberry(criteria));
      // }

      const settledResults = await Promise.allSettled(apiCalls);

      settledResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(...result.value);
        } else {
          console.warn(`API call ${index} failed:`, result.reason);
        }
      });

      // Handle no results based on strict mode
      if (results.length === 0) {
        if (shouldUseStrictMode) {
          throw new Error('🚫 No results from APIs. Strict API mode enabled - mock data disabled. Check your API keys and network connection.');
        } else {
          console.log(chalk.yellow('⚠️  No results from APIs, using mock data.'));
          const mockResults = this.generateMockProperties(criteria, 'MockAPI');
          this.addToCache(cacheKey, mockResults, criteria);
          return mockResults;
        }
      }

      this.addToCache(cacheKey, results, criteria);
      return results;
    } catch (error) {
      if (shouldUseStrictMode) {
        console.error(chalk.red('🚫 API Error in strict mode - no mock fallback available:'));
        throw error;
      }
      console.error('Error searching properties:', error);
      throw new Error('Failed to search properties from APIs');
    }
  }

  private generateCacheKey(criteria: SearchCriteria): string {
    // Create a stable cache key from search criteria
    const keyParts = [
      (criteria.city || '').toLowerCase(),
      (criteria.state || '').toLowerCase(),
      criteria.listingType,
      criteria.propertyType,
      criteria.minPrice?.toString() || '',
      criteria.maxPrice?.toString() || '',
      criteria.bedrooms?.toString() || '',
      criteria.bathrooms?.toString() || '',
      criteria.features.sort().join(',')
    ];
    
    return keyParts.filter(part => part !== '').join('|');
  }

  private getFromCache(key: string): Property[] | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  private addToCache(key: string, data: Property[], criteria: SearchCriteria): void {
    // Clean old entries if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(key, {
      data: [...data], // Clone to prevent mutations
      timestamp: Date.now(),
      criteria: JSON.stringify(criteria)
    });
  }

  private async searchApify(criteria: SearchCriteria): Promise<Property[]> {
    try {
      // Create actor run with search parameters for Zillow scraper
      const runResponse = await this.apifyClient.post(
        `/acts/${config.api.apify.actorId}/runs`,
        {
          searchUrls: [{
            url: this.buildZillowSearchUrl(criteria)
          }],
          maxItems: config.app.maxResultsPerApi,
          extractionMethod: "MAP_MARKERS",
          proxyConfiguration: {
            useApifyProxy: true
          }
        }
      );

      const runId = runResponse.data.data.id;

      // Wait for the run to finish
      let run;
      do {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const statusResponse = await this.apifyClient.get(`/acts/${config.api.apify.actorId}/runs/${runId}`);
        run = statusResponse.data.data;
      } while (run.status !== 'SUCCEEDED' && run.status !== 'FAILED');

      if (run.status === 'FAILED') {
        throw new Error('Apify actor run failed');
      }

      // Get the results
      const resultsResponse = await this.apifyClient.get(
        `/acts/${config.api.apify.actorId}/runs/${runId}/dataset/items`
      );

      const transformedResults = this.transformApifyResults(resultsResponse.data, criteria);

      return transformedResults;
    } catch (error) {
      if (config.app.strictApiMode && config.hasValidApifyConfig()) {
        console.log(chalk.red(`❌ Apify API failed in strict mode: ${error instanceof Error ? error.message : String(error)}`));
        throw error; // Don't fall back to mock data in strict mode
      }
      console.warn('Apify API error, falling back to mock data:', error instanceof Error ? error.message : String(error));
      return this.generateMockProperties(criteria, 'Apify');
    }
  }

  private async searchZillow(criteria: SearchCriteria): Promise<Property[]> {
    try {
      console.log(chalk.blue('🔍 Attempting Zillow API call...'));
      
      // Build search parameters - use only location and price range for better results
      const searchParams: any = {
        location: `${criteria.city}, ${criteria.state || ''}`
      };
      
      // Add listing type (rent vs buy)
      if (criteria.listingType === ListingType.RENT) {
        searchParams.status_type = 'ForRent';
      } else if (criteria.listingType === ListingType.BUY) {
        searchParams.status_type = 'ForSale';
      }
      // If ListingType.ANY, don't specify status_type to get both
      
      // Only add price filters if they exist
      if (criteria.minPrice) searchParams.minPrice = criteria.minPrice;
      if (criteria.maxPrice) searchParams.maxPrice = criteria.maxPrice;
      
      // ENHANCED: Add property type with strict filtering to exclude single family houses
      if (criteria.propertyType !== PropertyType.ANY) {
        const zillowHomeType = this.mapPropertyTypeToZillow(criteria.propertyType);
        if (zillowHomeType) {
          searchParams.home_type = zillowHomeType;
        }
        
        // For apartment searches, explicitly exclude single family residences
        if (criteria.propertyType === PropertyType.APARTMENT) {
          searchParams.excludeTypes = 'Houses,SingleFamily,Townhouse';
          // Also try different apartment-specific parameters
          searchParams.propertyTypes = 'Apartments,Condos,Multi-family';
        }
      }
      
      console.log(chalk.gray(`Search params: ${JSON.stringify(searchParams)}`));
      
      const response = await this.zillowClient.get('/propertyExtendedSearch', {
        params: searchParams
      });

      console.log(chalk.green(`✅ Zillow API success! Found ${response.data.props?.length || 0} properties`));
      return this.transformZillowResults(response.data, criteria);
    } catch (error) {
      if (config.app.strictApiMode && config.hasValidZillowConfig()) {
        console.log(chalk.red(`❌ Zillow API failed in strict mode: ${error instanceof Error ? error.message : String(error)}`));
        throw error; // Don't fall back to mock data in strict mode
      }
      console.log(chalk.red(`❌ Zillow API failed: ${error instanceof Error ? error.message : String(error)}`));
      console.warn('Zillow API error, using mock data:', error);
      return this.generateMockProperties(criteria, 'Zillow');
    }
  }

  private buildZillowSearchUrl(criteria: SearchCriteria): string {
    // Build Zillow search URL based on criteria
    const location = `${criteria.city}${criteria.state ? ', ' + criteria.state : ''}`;
    const baseUrl = 'https://www.zillow.com/homes/for_sale/';
    
    // Create search query state for Zillow
    const searchQuery = {
      pagination: {},
      mapBounds: {},
      filterState: {} as any,
      isListVisible: true,
      isMapVisible: false
    };

    // Add filters
    if (criteria.minPrice || criteria.maxPrice) {
      searchQuery.filterState.price = {};
      if (criteria.minPrice) searchQuery.filterState.price.min = criteria.minPrice;
      if (criteria.maxPrice) searchQuery.filterState.price.max = criteria.maxPrice;
    }

    if (criteria.bedrooms) {
      searchQuery.filterState.beds = { min: criteria.bedrooms };
    }

    if (criteria.bathrooms) {
      searchQuery.filterState.baths = { min: criteria.bathrooms };
    }

    // Add property type filtering - this was missing!
    if (criteria.propertyType !== PropertyType.ANY) {
      // Map our property types to Zillow's filter values
      const zillowTypeMapping: Record<PropertyType, any> = {
        [PropertyType.HOUSE]: { isSingleFamily: true },
        [PropertyType.APARTMENT]: { isApartment: true },
        [PropertyType.CONDO]: { isCondo: true },
        [PropertyType.TOWNHOUSE]: { isTownhouse: true },
        [PropertyType.ANY]: {} // No filter
      };
      
      const typeFilter = zillowTypeMapping[criteria.propertyType];
      if (typeFilter && Object.keys(typeFilter).length > 0) {
        searchQuery.filterState = { ...searchQuery.filterState, ...typeFilter };
      }
    }

    const searchParams = new URLSearchParams();
    searchParams.append('searchQueryState', JSON.stringify(searchQuery));
    
    return `${baseUrl}${encodeURIComponent(location)}/?${searchParams.toString()}`;
  }

  private mapPropertyTypeToZillow(type: PropertyType): string {
    const mapping: Record<PropertyType, string> = {
      [PropertyType.HOUSE]: 'Houses',
      [PropertyType.APARTMENT]: 'Apartments',
      [PropertyType.CONDO]: 'Condos',
      [PropertyType.TOWNHOUSE]: 'Townhouses',
      [PropertyType.ANY]: ''
    };
    return mapping[type];
  }

  private transformApifyResults(data: any, criteria: SearchCriteria): Property[] {
    // Transform Apify scraper results to our Property format
    // This would depend on the actual scraper output format
    return data.map((item: any) => ({
      id: `apify-${item.id || Math.random()}`,
      address: item.address || item.street,
      city: criteria.city,
      state: criteria.state || item.state,
      zipCode: item.zipCode || item.postalCode,
      listingType: criteria.listingType === ListingType.ANY 
        ? this.getRandomListingType() 
        : criteria.listingType,
      price: parseInt(item.price?.replace(/[^0-9]/g, '') || '0'),
      bedrooms: parseInt(item.bedrooms || '0'),
      bathrooms: parseFloat(item.bathrooms || '0'),
      squareFootage: parseInt(item.squareFootage?.replace(/[^0-9]/g, '') || '0'),
      propertyType: this.detectPropertyTypeFromScrapedData(item, criteria.propertyType),
      description: item.description || `Property in ${criteria.city}`,
      features: item.features || [],
      imageUrls: item.images || [],
      listingUrl: item.url || item.listingUrl,
      source: 'Apify',
      dateAdded: new Date(item.dateAdded || Date.now())
    })).filter((property: Property) => {
      // ENHANCED FILTERING: Apply strict property type filtering (same as Zillow)
      if (criteria.propertyType === PropertyType.ANY) {
        return true; // Accept all types
      }
      
      const matches = property.propertyType === criteria.propertyType;
      
      // Additional validation for apartment searches - be extra strict
      if (criteria.propertyType === PropertyType.APARTMENT && property.propertyType !== PropertyType.APARTMENT) {
        console.log(chalk.red(`🚫 FILTERED: Excluding ${property.address} (detected: ${property.propertyType}) from apartment search`));
        return false;
      }
      
      if (!matches) {
        console.log(chalk.yellow(`🚫 FILTERED: ${property.address} (detected: ${property.propertyType}) doesn't match requested: ${criteria.propertyType}`));
      } else {
        console.log(chalk.green(`✅ INCLUDED: ${property.address} (detected: ${property.propertyType}) matches requested: ${criteria.propertyType}`));
      }
      
      return matches;
    });
  }

  private transformZillowResults(data: any, criteria: SearchCriteria): Property[] {
    // Transform Zillow API results to our Property format
    // Real Zillow API returns data in 'props' array, not 'results'
    return (data.props || []).map((item: any) => ({
      id: `zillow-${item.zpid}`,
      address: item.address || `Property ${item.zpid}`,
      city: this.extractCityFromAddress(item.address) || criteria.city,
      state: this.extractStateFromAddress(item.address) || criteria.state || 'CA',
      zipCode: this.extractZipFromAddress(item.address) || '90000',
      listingType: criteria.listingType === ListingType.ANY 
        ? this.getRandomListingType() 
        : criteria.listingType,
      price: item.price || item.zestimate || 0,
      bedrooms: item.bedrooms || 0,
      bathrooms: item.bathrooms || 0,
      squareFootage: item.livingArea || 0,
      propertyType: this.detectPropertyTypeFromScrapedData(item, criteria.propertyType),
      description: `${item.propertyType || 'Property'} in ${criteria.city}`,
      features: this.extractZillowFeatures(item),
      imageUrls: item.imgSrc ? [item.imgSrc] : [],
      listingUrl: item.detailUrl ? `https://www.zillow.com${item.detailUrl}` : `https://www.zillow.com/homedetails/${item.zpid}_zpid/`,
      source: 'Zillow',
      dateAdded: new Date()
    })).filter((property: Property) => {
      // ENHANCED FILTERING: Apply strict property type filtering
      if (criteria.propertyType === PropertyType.ANY) {
        return true; // Accept all types
      }
      
      const matches = property.propertyType === criteria.propertyType;
      
      // Additional validation for apartment searches - be extra strict
      if (criteria.propertyType === PropertyType.APARTMENT && property.propertyType !== PropertyType.APARTMENT) {
        console.log(chalk.red(`🚫 FILTERED: Excluding ${property.address} (detected: ${property.propertyType}) from apartment search`));
        return false;
      }
      
      if (!matches) {
        console.log(chalk.yellow(`🚫 FILTERED: ${property.address} (detected: ${property.propertyType}) doesn't match requested: ${criteria.propertyType}`));
      } else {
        console.log(chalk.green(`✅ INCLUDED: ${property.address} (detected: ${property.propertyType}) matches requested: ${criteria.propertyType}`));
      }
      
      return matches;
    });
  }

  private extractZillowFeatures(item: any): string[] {
    const features: string[] = [];
    if (item.hasGarage) features.push('Garage');
    if (item.hasPool) features.push('Pool');
    if (item.hasPetsAllowed) features.push('Pet-friendly');
    if (item.hasInUnitLaundry) features.push('In-unit laundry');
    return features;
  }

  private generateMockProperties(criteria: SearchCriteria, source: string): Property[] {
    const properties: Property[] = [];
    const count = Math.floor(Math.random() * 15) + 5; // 5-20 properties

    // Define realistic listing websites based on source
    const listingDomains: Record<string, string[]> = {
      'Apify': [
        'https://www.realtor.com/realestateandhomes-detail',
        'https://www.zillow.com/homedetails',
        'https://www.trulia.com/p',
        'https://www.redfin.com/home'
      ],
      'MockAPI': [
        'https://www.apartments.com/listing',
        'https://www.rent.com/property',
        'https://www.rentals.com/details',
        'https://www.padmapper.com/apartments'
      ],
      'Zillow': [
        'https://www.zillow.com/homedetails',
        'https://www.zillow.com/b'
      ]
    };

    const domains = listingDomains[source] || listingDomains['MockAPI'];

    // Create diverse property configurations for better variety
    const diversityConfigs = [
      { bedrooms: 1, bathrooms: 1, priceMultiplier: 0.6, sqftRange: [400, 800], featureSet: 0 },
      { bedrooms: 2, bathrooms: 1, priceMultiplier: 0.8, sqftRange: [600, 1200], featureSet: 1 },
      { bedrooms: 2, bathrooms: 2, priceMultiplier: 1.0, sqftRange: [800, 1400], featureSet: 2 },
      { bedrooms: 3, bathrooms: 2, priceMultiplier: 1.3, sqftRange: [1000, 1800], featureSet: 3 },
      { bedrooms: 4, bathrooms: 3, priceMultiplier: 1.6, sqftRange: [1400, 2200], featureSet: 4 }
    ];

    // Create diverse feature sets
    const featureSets = [
      ['In-unit laundry', 'Balcony', 'Pet-friendly'],
      ['Gym', 'Pool', 'Doorman'],
      ['Garage', 'Garden', 'Fireplace'],
      ['Elevator', 'Rooftop deck', 'Storage'],
      ['Bike storage', 'Concierge', 'Hardwood floors']
    ];

    for (let i = 0; i < count; i++) {
      // Use different configurations to ensure variety
      const config = diversityConfigs[i % diversityConfigs.length];
      
      const basePrice = criteria.minPrice || 200000;
      const maxPrice = criteria.maxPrice || 800000;
      let price = Math.floor((basePrice + Math.random() * (maxPrice - basePrice)) * config.priceMultiplier);

      // Use diverse bedroom/bathroom configurations
      const bedrooms = Math.max(criteria.bedrooms || config.bedrooms, config.bedrooms);
      const bathrooms = Math.max(criteria.bathrooms || config.bathrooms, config.bathrooms);

      // Determine property type - FIX: Be more realistic about actual API behavior
      let propertyType: PropertyType;
      let actualZillowType: string; // Simulate what Zillow would actually return
      
      if (criteria.propertyType === PropertyType.ANY) {
        propertyType = this.getRandomPropertyType();
        actualZillowType = this.propertyTypeToZillowMockType(propertyType);
      } else {
        // FIXED: Real APIs generally DO return what you ask for when filtered properly
        // Only include a small percentage of "noise" to simulate API imperfection
        const shouldMatchRequest = Math.random() > 0.05; // 95% match requested type (much more realistic)
        
        if (shouldMatchRequest) {
          propertyType = criteria.propertyType;
          actualZillowType = this.propertyTypeToZillowMockType(propertyType);
        } else {
          // Simulate very occasional API "noise" - but prefer similar types over completely different ones
          let randomType: PropertyType;
          if (criteria.propertyType === PropertyType.APARTMENT) {
            // If looking for apartments, the "noise" should be condos (similar), not houses
            randomType = Math.random() > 0.5 ? PropertyType.CONDO : PropertyType.TOWNHOUSE;
          } else if (criteria.propertyType === PropertyType.HOUSE) {
            // If looking for houses, noise could be townhouse
            randomType = PropertyType.TOWNHOUSE;
          } else {
            randomType = PropertyType.HOUSE; // Default fallback
          }
          
          propertyType = randomType;
          actualZillowType = this.propertyTypeToZillowMockType(randomType);
          console.log(chalk.yellow(`🔀 MOCK: Simulating API noise - ${criteria.propertyType} search returned ${randomType}`));
        }
      }
      
      // Generate diverse feature sets
      const baseFeatures = [...new Set([...criteria.features, ...featureSets[config.featureSet]])];
      let features = baseFeatures;
      let squareFootage: number;
      let address: string;
      
      const streetNumber = Math.floor(Math.random() * 9999) + 1;
      const streetName = this.getRandomStreetName();
      
      // Use configuration-based square footage for more realistic variety
      const [minSqft, maxSqft] = config.sqftRange;
      squareFootage = Math.floor(Math.random() * (maxSqft - minSqft)) + minSqft;
      
      if (propertyType === PropertyType.APARTMENT) {
        // Apartment address with unit number
        const unitNumber = Math.floor(Math.random() * 500) + 101;
        address = `${streetNumber} ${streetName}, Unit ${unitNumber}`;
        
        // Apartment-specific pricing adjustment for rent
        if (criteria.listingType === ListingType.RENT) {
          price = Math.floor(price * 0.7); // Apartments typically cost less per month
        }
        
      } else {
        // House address (no unit number)
        address = `${streetNumber} ${streetName}`;
      }
      
      // Apply the same property type detection logic as real data
      const mockItem = {
        propertyType: actualZillowType,
        address: address
      };
      
      const detectedType = this.detectPropertyTypeFromScrapedData(mockItem, criteria.propertyType);
      
      // Only include this property if it matches the requested type (same filtering as real API)
      if (criteria.propertyType !== PropertyType.ANY && detectedType !== criteria.propertyType) {
        if (process.env.NODE_ENV !== 'production') {
          console.log(chalk.yellow(`🚫 MOCK: Filtered out ${address} (detected: ${detectedType}, zillow said: "${actualZillowType}") - requested: ${criteria.propertyType}`));
        }
        continue; // Skip this property - it doesn't match what user requested
      }
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(chalk.green(`✅ MOCK: Including ${address} (detected: ${detectedType}, zillow said: "${actualZillowType}") - matches requested: ${criteria.propertyType}`));
      }
      
      // Generate a realistic property ID
      const propertyId = Math.random().toString(36).substring(2, 15);
      
      // Select a random domain for this property
      const domain = domains[Math.floor(Math.random() * domains.length)];
      
      // Create a realistic-looking URL with note that it's demo data
      const urlSlug = `${streetNumber}-${streetName.toLowerCase().replace(/\s+/g, '-')}-${criteria.city.toLowerCase().replace(/\s+/g, '-')}-${criteria.state?.toLowerCase() || 'ca'}-${Math.floor(Math.random() * 90000) + 10000}`;
      const listingUrl = `${domain}/${urlSlug}/${propertyId}?demo=true`;

      properties.push({
        id: `${source.toLowerCase()}-${i + 1}`,
        address,
        city: criteria.city,
        state: criteria.state || 'OH',
        zipCode: `${Math.floor(Math.random() * 90000) + 10000}`,
        listingType: criteria.listingType === ListingType.ANY 
          ? this.getRandomListingType() 
          : criteria.listingType,
        price,
        bedrooms,
        bathrooms,
        squareFootage,
        propertyType: detectedType,
        description: `Beautiful ${detectedType} in ${criteria.city}${detectedType === PropertyType.APARTMENT ? ' with modern amenities' : ' with spacious rooms'}`,
        features,
        imageUrls: [
          `https://photos.zillowstatic.com/fp/${propertyId}-cc_ft_768.jpg`,
          `https://photos.zillowstatic.com/fp/${propertyId}-uncropped_scaled_within_1536_1152.jpg`
        ],
        listingUrl,
        source,
        dateAdded: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
      });
    }

    return properties;
  }

  private getRandomStreetName(): string {
    const streets = ['Main St', 'Oak Ave', 'Pine Rd', 'Elm Dr', 'Maple Ln', 'Cedar Blvd', 'Park Way'];
    return streets[Math.floor(Math.random() * streets.length)];
  }

  private getRandomPropertyType(): PropertyType {
    const types = [PropertyType.HOUSE, PropertyType.APARTMENT, PropertyType.CONDO, PropertyType.TOWNHOUSE];
    return types[Math.floor(Math.random() * types.length)];
  }

  private getRandomListingType(): ListingType {
    const types = [ListingType.RENT, ListingType.BUY];
    return types[Math.floor(Math.random() * types.length)];
  }

  private detectPropertyTypeFromScrapedData(item: any, requestedType: PropertyType): PropertyType {
    // Try to detect property type from scraped data
    // Look for common indicators in the scraped data
    
    // Check if there's explicit property type information
    if (item.home_type || item.propertyType || item.type) {
      const typeStr = (item.home_type || item.propertyType || item.type).toLowerCase();
      
      if (typeStr.includes('apartment') || typeStr.includes('apt') || typeStr.includes('multi-family') || typeStr.includes('multifamily')) {
        return PropertyType.APARTMENT;
      } else if (typeStr.includes('house') || 
                 typeStr.includes('single family') || 
                 typeStr.includes('single-family') ||
                 typeStr.includes('single_family') ||  // Handle Zillow's SINGLE_FAMILY format
                 typeStr.includes('single family residence') ||
                 typeStr.includes('residential') ||
                 typeStr.includes('sfr')) {
        return PropertyType.HOUSE;
      } else if (typeStr.includes('condo') || typeStr.includes('condominium')) {
        return PropertyType.CONDO;
      } else if (typeStr.includes('townhouse') || typeStr.includes('townhome')) {
        return PropertyType.TOWNHOUSE;
      }
    }

    // Try to infer from address (apartments often have unit numbers)
    const address = item.address || item.street || '';
    if (address.toLowerCase().includes('unit ') || 
        address.toLowerCase().includes('apt ') || 
        address.toLowerCase().includes('#')) {
      return PropertyType.APARTMENT;
    }

    // CRITICAL CHANGE: If user requested a specific property type and we can't confidently detect it,
    // mark as HOUSE (the most common unspecified type) so it gets filtered out during apartment searches
    if (requestedType !== PropertyType.ANY) {
      // For apartment searches, be very strict - if we can't clearly identify it as an apartment, 
      // assume it's NOT an apartment and mark as house so it gets filtered out
      if (requestedType === PropertyType.APARTMENT) {
        // If no clear apartment indicators found, default to HOUSE to exclude it
        console.log(chalk.yellow(`🚫 Property type unclear for ${address} - defaulting to HOUSE for apartment search exclusion`));
        return PropertyType.HOUSE;
      }
      
      // For other specific searches, also be conservative
      console.log(chalk.yellow(`🚫 Property type unclear for ${address} - defaulting to HOUSE`));
      return PropertyType.HOUSE;
    }

    // Only if searching for ANY type, return the requested type as fallback
    return requestedType;
  }

  private getRandomFeatures(requestedFeatures: string[]): string[] {
    const allFeatures = ['Pool', 'Garage', 'Garden', 'Fireplace', 'Balcony', 'Gym', 'Pet-friendly', 'In-unit laundry'];
    const features = [...requestedFeatures];
    
    // Add some random features
    const additionalFeatures = allFeatures.filter(f => !features.includes(f));
    const numAdditional = Math.floor(Math.random() * 3);
    
    for (let i = 0; i < numAdditional && additionalFeatures.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * additionalFeatures.length);
      features.push(additionalFeatures.splice(randomIndex, 1)[0]);
    }

    return features;
  }

  private extractCityFromAddress(address?: string): string | null {
    if (!address) return null;
    
    // Try to extract city from full address
    // Format examples: "123 Main St, Los Angeles, CA 90210" or "267 S San Pedro St UNIT 326, Los Angeles, CA 90012"
    const cityMatch = address.match(/,\s*([^,]+),\s*[A-Z]{2}\s*\d{5}/);
    if (cityMatch) {
      return cityMatch[1].trim();
    }
    
    return null;
  }

  private extractStateFromAddress(address?: string): string | null {
    if (!address) return null;
    
    // Extract state from address - look for 2-letter state code before zip
    // Format: "123 Main St, Los Angeles, CA 90210"
    const stateMatch = address.match(/,\s*([A-Z]{2})\s*\d{5}/);
    if (stateMatch) {
      return stateMatch[1];
    }
    
    return null;
  }

  private extractZipFromAddress(address?: string): string | null {
    if (!address) return null;
    
    // Extract 5-digit zip code
    const zipMatch = address.match(/\b(\d{5})\b/);
    if (zipMatch) {
      return zipMatch[1];
    }
    
    return null;
  }

  private propertyTypeToZillowMockType(type: PropertyType): string {
    const mapping: Record<PropertyType, string[]> = {
      [PropertyType.HOUSE]: ['Houses', 'Single family residence', 'single-family', 'residential'],
      [PropertyType.APARTMENT]: ['Apartments', 'apartment', 'apt'],
      [PropertyType.CONDO]: ['Condos', 'condominium', 'condo'],
      [PropertyType.TOWNHOUSE]: ['Townhouses', 'townhome', 'townhouse'],
      [PropertyType.ANY]: ['']
    };
    
    const options = mapping[type];
    return options[Math.floor(Math.random() * options.length)];
  }

}