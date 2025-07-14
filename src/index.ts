#!/usr/bin/env node

import { CliPrompts } from './cli/prompts';
import { RealEstateApiClient } from './api/realEstateApi';
import { PropertyService } from './services/propertyService';
import { DisplayUtils } from './utils/display';
import { ExportUtils } from './utils/export';
import { Property, SearchCriteria } from './types/property';
import ora from 'ora';
import chalk from 'chalk';

class RealEstateCliApp {
  private prompts: CliPrompts;
  private apiClient: RealEstateApiClient;
  private propertyService: PropertyService;
  private displayUtils: DisplayUtils;
  private exportUtils: ExportUtils;
  private currentProperties: Property[] = [];
  private currentCriteria: SearchCriteria | null = null;

  constructor() {
    this.prompts = new CliPrompts();
    this.apiClient = new RealEstateApiClient();
    this.propertyService = new PropertyService();
    this.displayUtils = new DisplayUtils();
    this.exportUtils = new ExportUtils();
  }

  async run(): Promise<void> {
    try {
      console.log(chalk.blue.bold('\n🏠 Welcome to Real Estate CLI Search Tool!\n'));
      
      while (true) {
        const action = this.currentProperties.length > 0 
          ? await this.prompts.getNextAction()
          : 'new';

        switch (action) {
          case 'new':
            await this.performNewSearch();
            break;
          case 'refine':
            await this.refineSearch();
            break;
          case 'export':
            await this.exportResults();
            break;
          case 'exit':
            console.log(chalk.blue('\n👋 Thank you for using Real Estate CLI Search Tool!'));
            return;
        }
      }
    } catch (error) {
      this.displayUtils.displayError(`Application error: ${error}`);
      process.exit(1);
    }
  }

  private async performNewSearch(): Promise<void> {
    try {
      // Get search criteria
      const criteria = await this.prompts.getSearchCriteria();
      
      // Confirm search
      const confirmed = await this.prompts.confirmSearch(criteria);
      if (!confirmed) {
        this.displayUtils.displayInfo('Search cancelled.');
        return;
      }

      await this.executeSearch(criteria);
    } catch (error) {
      this.displayUtils.displayError(`Search failed: ${error}`);
    }
  }

  private async refineSearch(): Promise<void> {
    if (!this.currentCriteria) {
      this.displayUtils.displayWarning('No previous search to refine.');
      return;
    }

    try {
      this.displayUtils.displayInfo('Current search criteria:');
      console.log(JSON.stringify(this.currentCriteria, null, 2));
      
      const newCriteria = await this.prompts.getSearchCriteria();
      await this.executeSearch(newCriteria);
    } catch (error) {
      this.displayUtils.displayError(`Refine search failed: ${error}`);
    }
  }

  private async executeSearch(criteria: SearchCriteria): Promise<void> {
    const spinner = ora('Searching properties...').start();

    try {
      // Search properties from APIs
      const rawProperties = await this.apiClient.searchProperties(criteria);
      spinner.text = 'Processing results...';

      // Aggregate, deduplicate, and rank
      const processedProperties = this.propertyService.aggregateAndProcess(rawProperties, criteria);

      spinner.succeed(`Found ${processedProperties.length} properties`);

      // Store results
      this.currentProperties = processedProperties;
      this.currentCriteria = criteria;

      // Display results
      this.displayResults();

    } catch (error) {
      spinner.fail('Search failed');
      throw error;
    }
  }

  private displayResults(): void {
    if (this.currentProperties.length === 0) {
      this.displayUtils.displayWarning('No properties found matching your criteria.');
      return;
    }

    // Display summary
    const summary = this.propertyService.getSearchSummary(this.currentProperties);
    this.displayUtils.displaySearchSummary(summary);

    // Display properties
    this.displayUtils.displayProperties(this.currentProperties, 15);

    // Show top property details
    if (this.currentProperties.length > 0) {
      console.log(chalk.blue('\n🌟 Top Match:'));
      this.displayUtils.displayPropertyDetails(this.currentProperties[0]);
    }
  }

  private async exportResults(): Promise<void> {
    if (this.currentProperties.length === 0) {
      this.displayUtils.displayWarning('No properties to export.');
      return;
    }

    try {
      const exportOptions = await this.prompts.getExportOptions();
      
      const spinner = ora(`Exporting to ${exportOptions.format.toUpperCase()}...`).start();
      
      const filepath = await this.exportUtils.exportProperties({
        format: exportOptions.format,
        filename: exportOptions.filename,
        properties: this.currentProperties
      });

      spinner.succeed(`Exported ${this.currentProperties.length} properties to ${filepath}`);
    } catch (error) {
      this.displayUtils.displayError(`Export failed: ${error}`);
    }
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error(chalk.red('\n💥 Uncaught Exception:'), error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('\n💥 Unhandled Rejection:'), reason);
  process.exit(1);
});

// Run the application
const app = new RealEstateCliApp();
app.run().catch((error) => {
  console.error(chalk.red('\n💥 Application Error:'), error);
  process.exit(1);
});