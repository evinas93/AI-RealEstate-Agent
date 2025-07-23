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
}

export interface ApiResponse {
  properties: Property[];
  totalCount: number;
  hasMore: boolean;
}

export interface ExportOptions {
  format: 'csv' | 'json';
  filename: string;
  properties: Property[];
}