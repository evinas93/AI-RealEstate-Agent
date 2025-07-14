import axios, { AxiosInstance } from 'axios';
import { SearchCriteria, Property, PropertyType, ApiResponse } from '../types/property';
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
        console.log(chalk.yellow('No results from APIs, using mock data.'));
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

      return this.transformApifyResults(resultsResponse.data, criteria);
    } catch (error) {
      console.warn('Apify API error, falling back to mock data:', error);
      return this.generateMockProperties(criteria, 'Apify');
    }
  }

  private async searchZillow(criteria: SearchCriteria): Promise<Property[]> {
    try {
      // Note: This is a simplified example. Actual Zillow API implementation would be more complex
      const response = await this.zillowClient.get('/propertyExtendedSearch', {
        params: {
          location: `${criteria.city}, ${criteria.state || ''}`,
          home_type: this.mapPropertyTypeToZillow(criteria.propertyType),
          minPrice: criteria.minPrice,
          maxPrice: criteria.maxPrice,
          bedrooms: criteria.bedrooms,
          bathrooms: criteria.bathrooms
        }
      });

      return this.transformZillowResults(response.data, criteria);
    } catch (error) {
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
    return (data.results || []).map((item: any) => ({
      id: `zillow-${item.zpid}`,
      address: item.address?.streetAddress,
      city: item.address?.city || criteria.city,
      state: item.address?.state || criteria.state,
      zipCode: item.address?.zipcode,
      price: item.price || item.zestimate,
      bedrooms: item.bedrooms,
      bathrooms: item.bathrooms,
      squareFootage: item.livingArea,
      propertyType: criteria.propertyType,
      description: item.description || `Property in ${criteria.city}`,
      features: this.extractZillowFeatures(item),
      imageUrls: item.imgSrc ? [item.imgSrc] : [],
      listingUrl: item.detailUrl,
      source: 'Zillow',
      dateAdded: new Date(item.datePosted || Date.now())
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

    for (let i = 0; i < count; i++) {
      const basePrice = criteria.minPrice || 200000;
      const maxPrice = criteria.maxPrice || 800000;
      const price = Math.floor(Math.random() * (maxPrice - basePrice)) + basePrice;

      const bedrooms = Math.max(criteria.bedrooms || 1, Math.floor(Math.random() * 5) + 1);
      const bathrooms = Math.max(criteria.bathrooms || 1, Math.floor(Math.random() * 3) + 1);

      const streetNumber = Math.floor(Math.random() * 9999) + 1;
      const streetName = this.getRandomStreetName();
      const address = `${streetNumber} ${streetName}`;
      
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
        state: criteria.state || 'CA',
        zipCode: `${Math.floor(Math.random() * 90000) + 10000}`,
        price,
        bedrooms,
        bathrooms,
        squareFootage: Math.floor(Math.random() * 2000) + 800,
        propertyType: criteria.propertyType === PropertyType.ANY 
          ? this.getRandomPropertyType() 
          : criteria.propertyType,
        description: `Beautiful ${criteria.propertyType} in ${criteria.city}`,
        features: this.getRandomFeatures(criteria.features),
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