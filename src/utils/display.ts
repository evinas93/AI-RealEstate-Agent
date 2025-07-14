import Table from 'cli-table3';
import chalk from 'chalk';
import { Property } from '../types/property';

export class DisplayUtils {
  displayProperties(properties: Property[], limit: number = 10): void {
    if (properties.length === 0) {
      console.log(chalk.yellow('\n📭 No properties found matching your criteria.'));
      return;
    }

    console.log(chalk.green(`\n🏠 Found ${properties.length} properties:\n`));

    const displayProperties = properties.slice(0, limit);

    const table = new Table({
      head: [
        chalk.cyan('Address'),
        chalk.cyan('Price'),
        chalk.cyan('Bed/Bath'),
        chalk.cyan('Type'),
        chalk.cyan('Score'),
        chalk.cyan('Source')
      ],
      colWidths: [30, 12, 10, 12, 8, 10],
      wordWrap: true
    });

    displayProperties.forEach(property => {
      table.push([
        `${property.address}\n${property.city}, ${property.state}`,
        chalk.green(`$${property.price.toLocaleString()}`),
        `${property.bedrooms}/${property.bathrooms}`,
        property.propertyType,
        property.score ? chalk.yellow(property.score.toString()) : 'N/A',
        property.source
      ]);
    });

    console.log(table.toString());

    if (properties.length > limit) {
      console.log(chalk.gray(`\n... and ${properties.length - limit} more properties`));
    }
  }

  displayPropertyDetails(property: Property): void {
    console.log(chalk.blue('\n' + '='.repeat(60)));
    console.log(chalk.bold.blue(`🏠 ${property.address}`));
    console.log(chalk.blue('='.repeat(60)));
    
    console.log(`📍 Location: ${property.city}, ${property.state} ${property.zipCode}`);
    console.log(`💰 Price: ${chalk.green('$' + property.price.toLocaleString())}`);
    console.log(`🛏️  Bedrooms: ${property.bedrooms}`);
    console.log(`🚿 Bathrooms: ${property.bathrooms}`);
    if (property.squareFootage) {
      console.log(`📐 Square Footage: ${property.squareFootage.toLocaleString()} sq ft`);
    }
    console.log(`🏷️  Type: ${property.propertyType}`);
    
    if (property.features.length > 0) {
      console.log(`✨ Features: ${property.features.join(', ')}`);
    }
    
    if (property.description) {
      console.log(`📝 Description: ${property.description}`);
    }
    
    console.log(`🔗 Listing: ${property.listingUrl}`);
    console.log(`📅 Added: ${property.dateAdded.toLocaleDateString()}`);
    console.log(`📊 Source: ${property.source}`);
    
    if (property.score) {
      console.log(`⭐ Match Score: ${chalk.yellow(property.score + '/100')}`);
    }
  }

  displaySearchSummary(summary: {
    totalCount: number;
    averagePrice: number;
    priceRange: { min: number; max: number };
    propertyTypes: Record<string, number>;
  }): void {
    console.log(chalk.blue('\n📊 Search Summary:'));
    console.log(`Total Properties: ${chalk.bold(summary.totalCount.toString())}`);
    
    if (summary.totalCount > 0) {
      console.log(`Average Price: ${chalk.green('$' + summary.averagePrice.toLocaleString())}`);
      console.log(`Price Range: ${chalk.green('$' + summary.priceRange.min.toLocaleString())} - ${chalk.green('$' + summary.priceRange.max.toLocaleString())}`);
      
      console.log('\nProperty Types:');
      Object.entries(summary.propertyTypes).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
    }
  }

  displayError(message: string): void {
    console.log(chalk.red(`\n❌ Error: ${message}`));
  }

  displaySuccess(message: string): void {
    console.log(chalk.green(`\n✅ ${message}`));
  }

  displayWarning(message: string): void {
    console.log(chalk.yellow(`\n⚠️  ${message}`));
  }

  displayInfo(message: string): void {
    console.log(chalk.blue(`\nℹ️  ${message}`));
  }
}