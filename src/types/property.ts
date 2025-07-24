export interface SearchCriteria {
  city: string;
  state?: string;
  listingType: ListingType;
  minPrice?: number;
  maxPrice?: number;
  propertyType: PropertyType;
  bedrooms?: number;
  bathrooms?: number;
  features: string[];
  
  // Advanced search criteria
  maxCommute?: number; // minutes to work/downtown
  minSquareFootage?: number;
  maxSquareFootage?: number;
  yearBuilt?: {
    min?: number;
    max?: number;
  };
  lotSize?: {
    min?: number; // in acres
    max?: number;
  };
  parking?: {
    required: boolean;
    spots?: number;
    type?: 'garage' | 'covered' | 'street' | 'any';
  };
  petPolicy?: {
    allowed: boolean;
    deposit?: number;
    restrictions?: string[];
  };
  moveInDate?: Date;
  leaseLength?: number; // months for rentals
  utilities?: {
    included?: string[]; // 'water', 'electric', 'gas', 'internet'
    excluded?: string[];
  };
  neighborhood?: {
    schoolRating?: number; // 1-10
    crimeRating?: 'low' | 'medium' | 'high';
    walkScore?: number; // 1-100
    publicTransport?: boolean;
  };
  investment?: {
    capRate?: number; // for investment properties
    appreciation?: number; // expected % growth
    rentabilityScore?: number; // 1-10
  };
}

export enum ListingType {
  RENT = 'rent',
  BUY = 'buy',
  ANY = 'any'
}

export enum PropertyType {
  HOUSE = 'house',
  APARTMENT = 'apartment',
  CONDO = 'condo',
  TOWNHOUSE = 'townhouse',
  ANY = 'any'
}

export interface Property {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  listingType: ListingType;
  price: number;
  bedrooms: number;
  bathrooms: number;
  squareFootage?: number;
  propertyType: PropertyType;
  description?: string;
  features: string[];
  imageUrls: string[];
  listingUrl: string;
  source: string;
  dateAdded: Date;
  score?: number;
  recommendations?: string[];
  marketInsights?: {
    averagePrice: number;
    medianPrice: number;
    pricePercentile: number;
    totalComparables: number;
    pricePosition: string;
  };
}

export interface ApiResponse {
  properties: Property[];
  totalCount: number;
  hasMore: boolean;
}

export interface ExportOptions {
  format: 'csv' | 'json' | 'html';
  filename: string;
  properties: Property[];
  conversation?: {
    messages: Array<{ role: string; content: string; timestamp: Date }>;
    preferences: any;
  };
}