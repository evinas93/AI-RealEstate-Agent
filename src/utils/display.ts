import Table from 'cli-table3';
import chalk from 'chalk';
import { Property, ListingType } from '../types/property';

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
        chalk.cyan('Listing'),
        chalk.cyan('Score'),
        chalk.cyan('Source')
      ],
      colWidths: [28, 12, 10, 10, 8, 8, 10],
      wordWrap: true
    });

    displayProperties.forEach(property => {
      const listingTypeDisplay = property.listingType === ListingType.RENT ? 'Rent' : 'Buy';
      const priceDisplay = property.listingType === ListingType.RENT 
        ? `$${property.price.toLocaleString()}/mo` 
        : `$${property.price.toLocaleString()}`;
      
      table.push([
        `${property.address}\n${property.city}, ${property.state}`,
        chalk.green(priceDisplay),
        `${property.bedrooms}/${property.bathrooms}`,
        property.propertyType,
        chalk.blue(listingTypeDisplay),
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
    
    const listingTypeDisplay = property.listingType === ListingType.RENT ? 'For Rent' : 'For Sale';
    const priceDisplay = property.listingType === ListingType.RENT 
      ? `$${property.price.toLocaleString()}/month` 
      : `$${property.price.toLocaleString()}`;
    
    console.log(`🏠 Listing Type: ${chalk.blue(listingTypeDisplay)}`);
    console.log(`💰 Price: ${chalk.green(priceDisplay)}`);
    
    if (property.squareFootage) {
      const pricePerSqFt = property.price / property.squareFootage;
      const pricePerSqFtDisplay = property.listingType === ListingType.RENT 
        ? `$${pricePerSqFt.toFixed(2)}/sq ft/month` 
        : `$${pricePerSqFt.toFixed(0)}/sq ft`;
      console.log(`📐 Square Footage: ${property.squareFootage.toLocaleString()} sq ft`);
      console.log(`💹 Price per sq ft: ${chalk.cyan(pricePerSqFtDisplay)}`);
    }
    
    console.log(`🛏️  Bedrooms: ${property.bedrooms}`);
    console.log(`🚿 Bathrooms: ${property.bathrooms}`);
    console.log(`🏷️  Type: ${property.propertyType}`);
    
    if (property.features.length > 0) {
      console.log(`✨ Features: ${property.features.join(', ')}`);
    }
    
    if (property.description) {
      console.log(`📝 Description: ${property.description}`);
    }

    // Display smart recommendations
    if (property.recommendations && property.recommendations.length > 0) {
      console.log(chalk.green('\n🎯 Smart Recommendations:'));
      property.recommendations.forEach(rec => {
        console.log(chalk.green(`   ${rec}`));
      });
    }

    // Display market insights
    if (property.marketInsights && property.marketInsights.totalComparables > 0) {
      console.log(chalk.cyan('\n📊 Market Analysis:'));
      console.log(chalk.cyan(`   📈 Position: ${property.marketInsights.pricePosition}`));
      console.log(chalk.cyan(`   📊 ${property.marketInsights.pricePercentile}th percentile (vs ${property.marketInsights.totalComparables} similar properties)`));
      
      const avgPriceDisplay = property.listingType === ListingType.RENT 
        ? `$${property.marketInsights.averagePrice.toLocaleString()}/month` 
        : `$${property.marketInsights.averagePrice.toLocaleString()}`;
      const medianPriceDisplay = property.listingType === ListingType.RENT 
        ? `$${property.marketInsights.medianPrice.toLocaleString()}/month` 
        : `$${property.marketInsights.medianPrice.toLocaleString()}`;
        
      console.log(chalk.cyan(`   💵 Market Average: ${avgPriceDisplay}`));
      console.log(chalk.cyan(`   📊 Market Median: ${medianPriceDisplay}`));
    }
    
    console.log(`🔗 Listing: ${property.listingUrl}`);
    console.log(`📅 Added: ${property.dateAdded.toLocaleDateString()}`);
    console.log(`📊 Source: ${property.source}`);
    
    if (property.score) {
      const scoreColor = property.score >= 80 ? chalk.green : property.score >= 60 ? chalk.yellow : chalk.red;
      console.log(`⭐ Match Score: ${scoreColor(property.score + '/100')}`);
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