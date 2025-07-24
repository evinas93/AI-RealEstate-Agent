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
      } else if (format === 'html') {
        await this.exportToHtml(filepath, properties, options);
      }

      return filepath;
    } catch (error) {
      throw new Error(`Failed to export to ${format}: ${error}`);
    }
  }

  private async exportToJson(filepath: string, properties: Property[], options?: ExportOptions): Promise<void> {
    const enhancedProperties = properties.map(property => this.beautifyProperty(property));
    
    const exportData = {
      "🏠 Real Estate Search Results": {
        "📊 Summary": {
          "Export Date": new Date().toLocaleDateString('en-US', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
          }),
          "Total Properties Found": properties.length,
          "💰 Price Range": this.getPriceRange(properties),
          "📍 Location": this.getSearchLocation(options),
          "🎯 Average Match Quality": `${this.getAverageScore(properties)}/100`
        },
        
        "🏆 Top Recommendations": {
          "🥇 Best Overall Match": this.getTopProperty(enhancedProperties, 'score'),
          "💎 Best Value": this.getTopProperty(enhancedProperties, 'value'),
          "✨ Newest Listing": this.getTopProperty(enhancedProperties, 'newest')
        },
        
        "📈 Market Insights": {
          "Average Price": this.formatCurrency(this.getAveragePrice(properties)),
          "Price per Sq Ft": this.formatCurrency(this.getAvgPricePerSqFt(properties)),
          "Property Types": this.getPropertyTypeDistribution(properties),
          "Listing Types": this.getListingTypeDistribution(properties)
        },
        
        "🏘️ All Properties": enhancedProperties
      },
      
      ...(options?.conversation && {
        "💬 Search Journey": this.beautifyConversation(options.conversation)
      })
    };

    await fs.writeFile(filepath, JSON.stringify(exportData, null, 2), 'utf-8');
  }

  private async exportToCsv(filepath: string, properties: Property[]): Promise<void> {
    const enhancedProperties = properties.map(property => ({
      "🏠 Address": property.address,
      "🌆 City": property.city,
      "🗺️ State": property.state,
      "📮 Zip Code": property.zipCode,
      "🏷️ Listing Type": this.capitalizeFirst(property.listingType),
      "💰 Price": this.formatCurrency(property.price),
      "🛏️ Bedrooms": property.bedrooms,
      "🚿 Bathrooms": property.bathrooms,
      "📐 Square Footage": property.squareFootage || 'N/A',
      "💵 Price per Sq Ft": property.squareFootage ? 
        this.formatCurrency(property.price / property.squareFootage) : 'N/A',
      "🏠 Property Type": this.capitalizeFirst(property.propertyType),
      "⭐ Match Score": `${property.score || 'N/A'}/100`,
      "✨ Key Features": property.features.join('; ') || 'None listed',
      "🌐 Listing URL": property.listingUrl,
      "📊 Source": property.source,
      "📅 Date Added": property.dateAdded.toLocaleDateString(),
      "💡 Investment Rating": this.getInvestmentRating(property),
      "📈 Market Position": this.getMarketPosition(property)
    }));

    const csvWriter = createObjectCsvWriter({
      path: filepath,
      header: Object.keys(enhancedProperties[0]).map(key => ({ id: key, title: key }))
    });

    await csvWriter.writeRecords(enhancedProperties);
  }

  private async exportToHtml(filepath: string, properties: Property[], options?: ExportOptions): Promise<void> {
    const htmlContent = this.generateBeautifulHtml(properties, options);
    const htmlFilepath = filepath.replace('.html', '.html');
    await fs.writeFile(htmlFilepath, htmlContent, 'utf-8');
  }

  private beautifyProperty(property: Property): any {
    return {
      "🏠 Property Details": {
        "📍 Address": property.address,
        "🌆 Location": `${property.city}, ${property.state} ${property.zipCode}`,
        "💰 Price": this.formatPropertyPrice(property),
        "🛏️ Bedrooms": property.bedrooms,
        "🚿 Bathrooms": property.bathrooms,
        "📐 Square Footage": property.squareFootage ? 
          `${property.squareFootage.toLocaleString()} sq ft` : 'Not specified',
        "🏷️ Property Type": this.capitalizeFirst(property.propertyType),
        "📝 Description": property.description || 'No description available'
      },
      
      "⭐ Match Information": {
        "🎯 Match Score": `${property.score || 'N/A'}/100`,
        "📊 Score Quality": this.getScoreQuality(property.score),
        "🏆 Ranking": this.getPropertyRanking(property)
      },
      
      "✨ Features & Amenities": {
        "🏠 Property Features": property.features.length > 0 ? 
          property.features : ['No specific features listed'],
        "💡 Highlights": this.generateHighlights(property)
      },
      
      "💼 Investment Analysis": {
        "💰 Price per Sq Ft": property.squareFootage ? 
          this.formatCurrency(property.price / property.squareFootage) : 'N/A',
        "📈 Market Position": this.getMarketPosition(property),
        "⏰ Days on Market": this.getDaysOnMarket(property),
        "💡 Investment Rating": this.getInvestmentRating(property)
      },
      
      "🔗 Links & Media": {
        "🌐 View Listing": property.listingUrl,
        "📸 Photos": property.imageUrls.length > 0 ? 
          `${property.imageUrls.length} photos available` : 'No photos available',
        "📊 Source": property.source,
        "📅 Listed": property.dateAdded.toLocaleDateString()
      }
    };
  }

  private generateBeautifulHtml(properties: Property[], options?: ExportOptions): string {
    const enhancedProperties = properties.map(p => this.beautifyProperty(p));
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🏠 Real Estate Search Results</title>
    <style>
        ${this.getCSSStyles()}
    </style>
</head>
<body>
    <header class="header">
        <h1>🏠 Your Real Estate Search Results</h1>
        <div class="summary-cards">
            ${this.generateSummaryCards(properties)}
        </div>
    </header>
    
    <main class="main-content">
        <section class="top-picks">
            <h2>🏆 Top Recommendations</h2>
            ${this.generateTopPicks(enhancedProperties)}
        </section>
        
        <section class="all-properties">
            <h2>🏘️ All Properties (${properties.length})</h2>
            <div class="properties-grid">
                ${enhancedProperties.map(property => this.generatePropertyCard(property)).join('')}
            </div>
        </section>
        
        ${options?.conversation ? this.generateConversationSection(options.conversation) : ''}
    </main>
    
    <footer class="footer">
        <p>Generated on ${new Date().toLocaleDateString()} by AI Real Estate Agent 🏠</p>
    </footer>
</body>
</html>`;
  }

  private getCSSStyles(): string {
    return `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      
      body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
      }
      
      .header {
          background: white;
          padding: 2rem;
          margin: 2rem;
          border-radius: 20px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          text-align: center;
      }
      
      .header h1 {
          color: #2c3e50;
          margin-bottom: 1.5rem;
          font-size: 2.5rem;
      }
      
      .summary-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-top: 2rem;
      }
      
      .summary-card {
          background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);
          padding: 1.5rem;
          border-radius: 15px;
          text-align: center;
          color: white;
          font-weight: 600;
      }
      
      .card-value {
          font-size: 2rem;
          font-weight: bold;
          margin-bottom: 0.5rem;
      }
      
      .property-card {
          background: white;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          margin-bottom: 2rem;
      }
      
      .property-card:hover {
          transform: translateY(-10px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.15);
      }
      
      .property-header {
          background: linear-gradient(135deg, #ff6b6b 0%, #ff8e53 100%);
          color: white;
          padding: 1.5rem;
          text-align: center;
      }
      
      .property-content {
          padding: 2rem;
      }
      
      .property-details {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
      }
      
      .detail-item {
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 10px;
          text-align: center;
      }
      
      .price {
          font-size: 2rem;
          font-weight: bold;
          color: #27ae60;
      }
      
      .score-badge {
          background: #3498db;
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 50px;
          font-weight: bold;
          display: inline-block;
      }
      
      .features-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin: 1rem 0;
      }
      
      .feature-tag {
          background: #e74c3c;
          color: white;
          padding: 0.3rem 0.8rem;
          border-radius: 20px;
          font-size: 0.9rem;
      }
      
      .main-content {
          margin: 2rem;
      }
      
      .properties-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 2rem;
      }
      
      .top-picks {
          background: white;
          padding: 2rem;
          border-radius: 20px;
          margin-bottom: 2rem;
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
      }
      
      .footer {
          text-align: center;
          padding: 2rem;
          color: white;
          margin-top: 2rem;
      }
    `;
  }

  // Helper methods for formatting and calculations
  private formatPropertyPrice(property: Property): string {
    const price = this.formatCurrency(property.price);
    const suffix = property.listingType === 'rent' ? '/month' : '';
    const emoji = property.listingType === 'rent' ? '🏠' : '💰';
    return `${emoji} ${price}${suffix}`;
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private generateHighlights(property: Property): string[] {
    const highlights = [];
    
    if (property.squareFootage && property.squareFootage > 2000) {
      highlights.push('🏡 Spacious - Over 2,000 sq ft');
    }
    
    if (property.score && property.score > 80) {
      highlights.push('⭐ Excellent Match');
    }
    
    if (property.bathrooms >= 3) {
      highlights.push('🚿 Multiple Bathrooms');
    }
    
    if (property.features.includes('Pool')) {
      highlights.push('🏊 Swimming Pool');
    }
    
    if (property.features.includes('Garage')) {
      highlights.push('🚗 Garage Parking');
    }
    
    return highlights.length > 0 ? highlights : ['🏠 Quality Property'];
  }

  private getAveragePrice(properties: Property[]): number {
    if (properties.length === 0) return 0;
    const total = properties.reduce((sum, p) => sum + p.price, 0);
    return Math.round(total / properties.length);
  }

  private getAvgPricePerSqFt(properties: Property[]): number {
    const propertiesWithSqFt = properties.filter(p => p.squareFootage);
    if (propertiesWithSqFt.length === 0) return 0;
    
    const total = propertiesWithSqFt.reduce((sum, p) => sum + (p.price / p.squareFootage!), 0);
    return Math.round(total / propertiesWithSqFt.length);
  }

  private getPriceRange(properties: Property[]): string {
    if (properties.length === 0) return 'N/A';
    
    const prices = properties.map(p => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    
    return `${this.formatCurrency(min)} - ${this.formatCurrency(max)}`;
  }

  private getAverageScore(properties: Property[]): number {
    const propertiesWithScores = properties.filter(p => p.score);
    if (propertiesWithScores.length === 0) return 0;
    
    const total = propertiesWithScores.reduce((sum, p) => sum + p.score!, 0);
    return Math.round(total / propertiesWithScores.length);
  }

  private getSearchLocation(options?: ExportOptions): string {
    if (options?.conversation?.preferences) {
      const prefs = options.conversation.preferences;
      return `${prefs.city || 'Unknown'}${prefs.state ? ', ' + prefs.state : ''}`;
    }
    return 'Multiple Locations';
  }

  private getPropertyTypeDistribution(properties: Property[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    properties.forEach(p => {
      const type = this.capitalizeFirst(p.propertyType);
      distribution[type] = (distribution[type] || 0) + 1;
    });
    return distribution;
  }

  private getListingTypeDistribution(properties: Property[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    properties.forEach(p => {
      const type = this.capitalizeFirst(p.listingType);
      distribution[type] = (distribution[type] || 0) + 1;
    });
    return distribution;
  }

  private getTopProperty(properties: any[], criteria: 'score' | 'value' | 'newest'): any {
    if (properties.length === 0) return 'No properties available';
    
    switch (criteria) {
      case 'score':
        return properties.reduce((best, current) => {
          const bestScore = best["⭐ Match Information"]?.["🎯 Match Score"] || '0/100';
          const currentScore = current["⭐ Match Information"]?.["🎯 Match Score"] || '0/100';
          return parseInt(currentScore) > parseInt(bestScore) ? current : best;
        });
      case 'value':
        // Simplified value calculation - you could enhance this
        return properties[0]; // For now, return first property
      case 'newest':
        return properties[0]; // For now, return first property
      default:
        return properties[0];
    }
  }

  private beautifyConversation(conversation: any): any {
    return {
      "📝 Search Preferences": conversation.preferences,
      "💬 Chat History": conversation.messages.map((msg: any) => ({
        "👤 Role": msg.role === 'user' ? '🧑 User' : '🤖 AI Assistant',
        "💭 Message": msg.content,
        "⏰ Time": new Date(msg.timestamp).toLocaleTimeString()
      }))
    };
  }

  private generateSummaryCards(properties: Property[]): string {
    const totalProperties = properties.length;
    const avgPrice = this.getAveragePrice(properties);
    const bestScore = Math.max(...properties.map(p => p.score || 0));
    const priceRange = this.getPriceRange(properties);
    
    return `
      <div class="summary-card">
        <div class="card-value">${totalProperties}</div>
        <div class="card-label">🏠 Properties Found</div>
      </div>
      <div class="summary-card">
        <div class="card-value">${this.formatCurrency(avgPrice)}</div>
        <div class="card-label">💰 Average Price</div>
      </div>
      <div class="summary-card">
        <div class="card-value">${bestScore}/100</div>
        <div class="card-label">⭐ Best Match Score</div>
      </div>
      <div class="summary-card">
        <div class="card-value">${priceRange}</div>
        <div class="card-label">📊 Price Range</div>
      </div>
    `;
  }

  private generateTopPicks(properties: any[]): string {
    const bestMatch = this.getTopProperty(properties, 'score');
    return `
      <div class="top-pick">
        <h3>🥇 Best Overall Match</h3>
        <p><strong>Address:</strong> ${bestMatch["🏠 Property Details"]?.["📍 Address"] || 'N/A'}</p>
        <p><strong>Price:</strong> ${bestMatch["🏠 Property Details"]?.["💰 Price"] || 'N/A'}</p>
        <p><strong>Score:</strong> ${bestMatch["⭐ Match Information"]?.["🎯 Match Score"] || 'N/A'}</p>
      </div>
    `;
  }

  private generatePropertyCard(property: any): string {
    const details = property["🏠 Property Details"];
    const match = property["⭐ Match Information"];
    const features = property["✨ Features & Amenities"];
    
    return `
      <div class="property-card">
        <div class="property-header">
          <h3>${details?.["📍 Address"] || 'Unknown Address'}</h3>
          <div class="price">${details?.["💰 Price"] || 'Price TBD'}</div>
        </div>
        <div class="property-content">
          <div class="property-details">
            <div class="detail-item">
              <strong>🛏️ Bedrooms</strong><br>
              ${details?.["🛏️ Bedrooms"] || 'N/A'}
            </div>
            <div class="detail-item">
              <strong>🚿 Bathrooms</strong><br>
              ${details?.["🚿 Bathrooms"] || 'N/A'}
            </div>
            <div class="detail-item">
              <strong>📐 Size</strong><br>
              ${details?.["📐 Square Footage"] || 'N/A'}
            </div>
            <div class="detail-item">
              <strong>⭐ Score</strong><br>
              <span class="score-badge">${match?.["🎯 Match Score"] || 'N/A'}</span>
            </div>
          </div>
          <div class="features-list">
            ${features?.["💡 Highlights"]?.map((highlight: string) => 
              `<span class="feature-tag">${highlight}</span>`
            ).join('') || ''}
          </div>
        </div>
      </div>
    `;
  }

  private generateConversationSection(conversation: any): string {
    return `
      <section class="conversation-section">
        <h2>💬 Your Search Journey</h2>
        <div class="conversation-content">
          <!-- Conversation details would go here -->
        </div>
      </section>
    `;
  }

  private getScoreQuality(score?: number): string {
    if (!score) return 'Not rated';
    if (score >= 90) return '🌟 Excellent';
    if (score >= 80) return '⭐ Great';
    if (score >= 70) return '👍 Good';
    if (score >= 60) return '👌 Fair';
    return '⚠️ Below average';
  }

  private getPropertyRanking(property: Property): string {
    // Simplified ranking - you could enhance this with actual ranking logic
    return 'Top 10%';
  }

  private getDaysOnMarket(property: Property): string {
    const daysSinceAdded = Math.floor((Date.now() - property.dateAdded.getTime()) / (1000 * 60 * 60 * 24));
    return `${daysSinceAdded} days`;
  }

  private getInvestmentRating(property: Property): string {
    // Simplified investment rating
    if (property.score && property.score > 80) return '🏆 Excellent';
    if (property.score && property.score > 70) return '⭐ Good';
    if (property.score && property.score > 60) return '👍 Fair';
    return '⚠️ Consider carefully';
  }

  private getMarketPosition(property: Property): string {
    // Simplified market position
    if (property.squareFootage && property.price / property.squareFootage < 200) return '💎 Great value';
    if (property.squareFootage && property.price / property.squareFootage < 300) return '👍 Fair value';
    return '💰 Premium priced';
  }
}