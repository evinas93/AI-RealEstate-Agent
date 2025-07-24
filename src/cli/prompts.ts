import inquirer from 'inquirer';
import { SearchCriteria, PropertyType, ListingType } from '../types/property';

export class CliPrompts {
  async getSearchCriteria(): Promise<SearchCriteria> {
    console.log('\n🏠 Real Estate Search Tool\n');

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'city',
        message: 'Enter the city to search in:',
        validate: (input: string) => input.trim().length > 0 || 'City is required'
      },
      {
        type: 'input',
        name: 'state',
        message: 'Enter the state (optional):',
      },
      {
        type: 'list',
        name: 'listingType',
        message: 'Are you looking to rent or buy?',
        choices: [
          { name: '🏠 Buy', value: ListingType.BUY },
          { name: '🏠 Rent', value: ListingType.RENT },
          { name: '🔍 Any (both rent and buy)', value: ListingType.ANY }
        ]
      },
      {
        type: 'list',
        name: 'propertyType',
        message: 'Select property type:',
        choices: [
          { name: 'Any', value: PropertyType.ANY },
          { name: 'House', value: PropertyType.HOUSE },
          { name: 'Apartment', value: PropertyType.APARTMENT },
          { name: 'Condo', value: PropertyType.CONDO },
          { name: 'Townhouse', value: PropertyType.TOWNHOUSE }
        ]
      },
      {
        type: 'number',
        name: 'minPrice',
        message: (answers: any) => answers.listingType === ListingType.RENT 
          ? 'Minimum monthly rent (optional):' 
          : 'Minimum price (optional):',
        validate: (input: number) => !input || input > 0 || 'Price must be positive'
      },
      {
        type: 'number',
        name: 'maxPrice',
        message: (answers: any) => answers.listingType === ListingType.RENT 
          ? 'Maximum monthly rent (optional):' 
          : 'Maximum price (optional):',
        validate: (input: number) => !input || input > 0 || 'Price must be positive'
      },
      {
        type: 'number',
        name: 'bedrooms',
        message: 'Minimum bedrooms (optional):',
        validate: (input: number) => !input || input > 0 || 'Bedrooms must be positive'
      },
      {
        type: 'number',
        name: 'bathrooms',
        message: 'Minimum bathrooms (optional):',
        validate: (input: number) => !input || input > 0 || 'Bathrooms must be positive'
      },
      {
        type: 'checkbox',
        name: 'features',
        message: 'Select desired features:',
        choices: [
          'Pool',
          'Garage',
          'Garden',
          'Fireplace',
          'Balcony',
          'Gym',
          'Pet-friendly',
          'In-unit laundry',
          'Recently renovated',
          'Near public transport'
        ]
      }
    ]);

    return {
      city: answers.city.trim(),
      state: answers.state?.trim() || undefined,
      listingType: answers.listingType,
      propertyType: answers.propertyType,
      minPrice: answers.minPrice || undefined,
      maxPrice: answers.maxPrice || undefined,
      bedrooms: answers.bedrooms || undefined,
      bathrooms: answers.bathrooms || undefined,
      features: answers.features || []
    };
  }

  async getNextAction(): Promise<'refine' | 'new' | 'export' | 'exit'> {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do next?',
        choices: [
          { name: '🔍 Refine current search', value: 'refine' },
          { name: '🆕 Start new search', value: 'new' },
          { name: '📁 Export results', value: 'export' },
          { name: '🚪 Exit', value: 'exit' }
        ]
      }
    ]);

    return action;
  }

  async getExportOptions(): Promise<{ format: 'csv' | 'json' | 'html'; filename: string }> {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'format',
        message: '📁 Select export format:',
        choices: [
          { name: '📊 JSON - Beautiful structured data with emojis and insights', value: 'json' },
          { name: '📈 CSV - Enhanced spreadsheet with emojis and calculations', value: 'csv' },
          { name: '🌐 HTML - Stunning visual report with charts and styling', value: 'html' }
        ]
      },
      {
        type: 'input',
        name: 'filename',
        message: '📝 Enter filename (without extension):',
        default: `real-estate-search-${new Date().toISOString().split('T')[0]}`,
        validate: (input: string) => input.trim().length > 0 || 'Filename is required'
      }
    ]);

    return answers;
  }

  async confirmSearch(criteria: SearchCriteria): Promise<boolean> {
    console.log('\n📋 Search Summary:');
    console.log(`City: ${criteria.city}${criteria.state ? `, ${criteria.state}` : ''}`);
    console.log(`Listing Type: ${criteria.listingType === ListingType.RENT ? 'Rent' : criteria.listingType === ListingType.BUY ? 'Buy' : 'Any'}`);
    console.log(`Property Type: ${criteria.propertyType}`);
    
    const priceLabel = criteria.listingType === ListingType.RENT ? 'Rent' : 'Price';
    if (criteria.minPrice) console.log(`Min ${priceLabel}: $${criteria.minPrice.toLocaleString()}`);
    if (criteria.maxPrice) console.log(`Max ${priceLabel}: $${criteria.maxPrice.toLocaleString()}`);
    if (criteria.bedrooms) console.log(`Min Bedrooms: ${criteria.bedrooms}`);
    if (criteria.bathrooms) console.log(`Min Bathrooms: ${criteria.bathrooms}`);
    if (criteria.features.length > 0) console.log(`Features: ${criteria.features.join(', ')}`);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Proceed with this search?',
        default: true
      }
    ]);

    return confirm;
  }
}