import axios, { AxiosInstance } from 'axios';
import { SearchCriteria, Property, PropertyType, ListingType, ApiResponse } from '../types/property';
import config from '../config';
import chalk from 'chalk';

export class RealEstateApiClient {
  private apifyClient: AxiosInstance;
  private zillowClient: AxiosInstance;

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
    const results: Property[] = [];

    // Check if we should use mock data
    if (config.app.useMockData || !config.hasAnyValidApiConfig()) {
      if (!config.hasAnyValidApiConfig()) {
        console.log(chalk.yellow('\n⚠️  No API keys configured. Using mock data.'));
        console.log(chalk.gray('To use real data, copy .env.example to .env and add your API keys.'));
        console.log(chalk.gray('Note: URLs shown are simulated but follow real listing site patterns.\n'));
      }
      return this.generateMockProperties(criteria, 'MockAPI');
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

      // If no results from real APIs, fall back to mock data
      if (results.length === 0) {
        console.log(chalk.yellow('⚠️  No results from APIs, using mock data.'));
        return this.generateMockProperties(criteria, 'MockAPI');
      }

      return results;
    } catch (error) {
      console.error('Error searching properties:', error);
      throw new Error('Failed to search properties from APIs');
    }
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
      
      // Add property type only if it's not 'any'
      if (criteria.propertyType !== 'any') {
        searchParams.home_type = this.mapPropertyTypeToZillow(criteria.propertyType);
      }
      
      console.log(chalk.gray(`Search params: ${JSON.stringify(searchParams)}`));
      
      const response = await this.zillowClient.get('/propertyExtendedSearch', {
        params: searchParams
      });

      console.log(chalk.green(`✅ Zillow API success! Found ${response.data.props?.length || 0} properties`));
      return this.transformZillowResults(response.data, criteria);
    } catch (error) {
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
      propertyType: criteria.propertyType,
      description: item.description || `Property in ${criteria.city}`,
      features: item.features || [],
      imageUrls: item.images || [],
      listingUrl: item.url || item.listingUrl,
      source: 'Apify',
      dateAdded: new Date(item.dateAdded || Date.now())
    }));
  }

  private transformZillowResults(data: any, criteria: SearchCriteria): Property[] {
    // Transform Zillow API results to our Property format
    // Real Zillow API returns data in 'props' array, not 'results'
    return (data.props || []).map((item: any) => ({
      id: `zillow-${item.zpid}`,
      address: item.address || `Property ${item.zpid}`,
      city: criteria.city,
      state: criteria.state || 'OH',
      zipCode: item.address?.match(/(\d{5})/) ? item.address.match(/(\d{5})/)[1] : '43215',
      listingType: criteria.listingType === ListingType.ANY 
        ? this.getRandomListingType() 
        : criteria.listingType,
      price: item.price || item.zestimate || 0,
      bedrooms: item.bedrooms || 0,
      bathrooms: item.bathrooms || 0,
      squareFootage: item.livingArea || 0,
      propertyType: criteria.propertyType,
      description: `${item.propertyType || 'Property'} in ${criteria.city}`,
      features: this.extractZillowFeatures(item),
      imageUrls: item.imgSrc ? [item.imgSrc] : [],
      listingUrl: item.detailUrl ? `https://www.zillow.com${item.detailUrl}` : `https://www.zillow.com/homedetails/${item.zpid}_zpid/`,
      source: 'Zillow',
      dateAdded: new Date()
    }));
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

      // Determine property type - respect the criteria better
      let propertyType = criteria.propertyType;
      if (criteria.propertyType === PropertyType.ANY) {
        propertyType = this.getRandomPropertyType();
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
        propertyType,
        description: `Beautiful ${propertyType} in ${criteria.city}${propertyType === PropertyType.APARTMENT ? ' with modern amenities' : ' with spacious rooms'}`,
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
}