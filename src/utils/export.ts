import fs from 'fs/promises';
import path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import { Property, ExportOptions } from '../types/property';

export class ExportUtils {
  async exportProperties(options: ExportOptions): Promise<string> {
    const { format, filename, properties } = options;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fullFilename = `${filename}-${timestamp}.${format}`;
    const filepath = path.resolve(process.cwd(), fullFilename);

    try {
      if (format === 'json') {
        await this.exportToJson(filepath, properties, options);
      } else if (format === 'csv') {
        await this.exportToCsv(filepath, properties);
      }

      return filepath;
    } catch (error) {
      throw new Error(`Failed to export to ${format}: ${error}`);
    }
  }

  private async exportToJson(filepath: string, properties: Property[], options?: ExportOptions): Promise<void> {
    const exportData: any = {
      exportDate: new Date().toISOString(),
      totalProperties: properties.length,
      properties: properties.map(property => ({
        ...property,
        dateAdded: property.dateAdded.toISOString()
      }))
    };

    // Add conversation history if provided
    if (options?.conversation) {
      exportData.conversation = {
        messages: options.conversation.messages.map(msg => ({
          ...msg,
          timestamp: msg.timestamp.toISOString()
        })),
        extractedPreferences: options.conversation.preferences
      };
    }

    await fs.writeFile(filepath, JSON.stringify(exportData, null, 2), 'utf-8');
  }

  private async exportToCsv(filepath: string, properties: Property[]): Promise<void> {
    const csvWriter = createObjectCsvWriter({
      path: filepath,
      header: [
        { id: 'id', title: 'ID' },
        { id: 'address', title: 'Address' },
        { id: 'city', title: 'City' },
        { id: 'state', title: 'State' },
        { id: 'zipCode', title: 'Zip Code' },
        { id: 'listingType', title: 'Listing Type' },
        { id: 'price', title: 'Price' },
        { id: 'bedrooms', title: 'Bedrooms' },
        { id: 'bathrooms', title: 'Bathrooms' },
        { id: 'squareFootage', title: 'Square Footage' },
        { id: 'propertyType', title: 'Property Type' },
        { id: 'features', title: 'Features' },
        { id: 'listingUrl', title: 'Listing URL' },
        { id: 'source', title: 'Source' },
        { id: 'dateAdded', title: 'Date Added' },
        { id: 'score', title: 'Match Score' }
      ]
    });

    const csvData = properties.map(property => ({
      ...property,
      features: property.features.join('; '),
      dateAdded: property.dateAdded.toISOString(),
      score: property.score || 'N/A'
    }));

    await csvWriter.writeRecords(csvData);
  }
}