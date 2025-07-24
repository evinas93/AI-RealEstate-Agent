import { EvaluationRunner } from '../evals/evalRunner';
import { ConversationalAgent } from '../agents/conversationalAgent';
import { RealEstateApiClient } from '../api/realEstateApi';
import { PropertyService } from '../services/propertyService';
import { ConversationMemory } from '../agents/conversationMemory';

// Example 1: Enhanced Conversational Agent with Tracing
export class TracedConversationalAgent extends ConversationalAgent {
  private evalRunner: EvaluationRunner;
  
  constructor(memory: ConversationMemory, evalRunner: EvaluationRunner) {
    super(memory);
    this.evalRunner = evalRunner;
  }

  async processUserInput(input: string): Promise<{ 
    response: string; 
    shouldSearch: boolean; 
    searchCriteria?: any;
    isExiting?: boolean;
  }> {
    const tracer = this.evalRunner.getTracer();
    
    // Start tracing the conversation step
    const spanId = tracer.startSpan('ai_process_user_input', undefined, {
      inputLength: input.length,
      userInput: input.substring(0, 100) // First 100 chars for debugging
    });

    try {
      // Add conversation step tracking
      const conversationId = 'current_session'; // Would be dynamic in real implementation
      const stepId = tracer.addConversationStep(
        conversationId, 
        'ai_processing', 
        input
      );

      const startTime = Date.now();
      
      // Call the original method
      const result = await super.processUserInput(input);
      
      const processingTime = Date.now() - startTime;
      
      // Complete the conversation step
      tracer.completeConversationStep(conversationId, stepId, result.response);
      
      // Log performance metrics
      tracer.log(spanId, 'info', 'AI processing completed', {
        processingTime,
        shouldSearch: result.shouldSearch,
        responseLength: result.response.length
      });

      // Evaluate the conversation in real-time
      if (result.shouldSearch && result.searchCriteria) {
        const conversationEvaluator = this.evalRunner.getConversationEvaluator();
        
        // Mock conversation for evaluation (in real app, use actual conversation history)
        const mockConversation = [
          { role: 'user', content: input },
          { role: 'assistant', content: result.response }
        ];
        
        const evaluation = await conversationEvaluator.evaluateConversation(
          mockConversation,
          result.searchCriteria
        );
        
        tracer.log(spanId, 'info', 'Conversation evaluated', {
          accuracy: evaluation.accuracy,
          overallScore: evaluation.overallScore
        });
      }

      tracer.finishSpan(spanId, 'success');
      return result;
      
    } catch (error) {
      tracer.finishSpan(spanId, 'error', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

// Example 2: Enhanced API Client with Performance Tracking
export class TracedRealEstateApiClient extends RealEstateApiClient {
  private evalRunner: EvaluationRunner;

  constructor(evalRunner: EvaluationRunner) {
    super();
    this.evalRunner = evalRunner;
  }

  async searchProperties(criteria: any): Promise<any[]> {
    const tracer = this.evalRunner.getTracer();
    const propertyEvaluator = this.evalRunner.getPropertyEvaluator();
    
    // Start overall search span
    const searchSpanId = tracer.startSpan('property_search', undefined, {
      city: criteria.city,
      propertyType: criteria.propertyType,
      priceRange: `${criteria.minPrice || 0}-${criteria.maxPrice || 'unlimited'}`
    });

    try {
      const startTime = Date.now();
      
      // Track individual API calls
      const zillowTrace = tracer.traceApiCall('Zillow', '/propertyExtendedSearch', 'GET');
      
      // Call the original method
      const properties = await super.searchProperties(criteria);
      
      const searchTime = Date.now() - startTime;
      
      // Complete API trace
      zillowTrace.complete('success');
      zillowTrace.setResponseSize(JSON.stringify(properties).length);
      
      // Track API performance for evaluation
      propertyEvaluator.trackApiPerformance('Zillow', searchTime, true, 1.0);
      
      // Evaluate search results
      const evaluation = propertyEvaluator.evaluateSearchResults(properties, criteria, searchTime);
      
      tracer.log(searchSpanId, 'info', 'Property search completed', {
        resultCount: properties.length,
        searchTime,
        relevanceScore: evaluation.relevance,
        overallScore: evaluation.overallScore
      });

      // Log potential issues
      if (evaluation.relevance < 0.7) {
        tracer.log(searchSpanId, 'warn', 'Low relevance score detected', {
          relevance: evaluation.relevance,
          suggestion: 'Review search criteria or ranking algorithm'
        });
      }

      if (searchTime > 5000) {
        tracer.log(searchSpanId, 'warn', 'Slow search detected', {
          searchTime,
          suggestion: 'Consider implementing caching or optimizing API calls'
        });
      }

      tracer.finishSpan(searchSpanId, 'success');
      return properties;
      
    } catch (error) {
      // Track API failure
      const zillowTrace = tracer.traceApiCall('Zillow', '/propertyExtendedSearch', 'GET');
      zillowTrace.complete('error', error instanceof Error ? error.message : String(error));
      
      propertyEvaluator.trackApiPerformance('Zillow', Date.now() - Date.now(), false, 0);
      
      tracer.finishSpan(searchSpanId, 'error', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

// Example 3: Enhanced Property Service with Ranking Evaluation
export class TracedPropertyService extends PropertyService {
  private evalRunner: EvaluationRunner;

  constructor(evalRunner: EvaluationRunner) {
    super();
    this.evalRunner = evalRunner;
  }

  aggregateAndProcess(properties: any[], criteria: any): any[] {
    const tracer = this.evalRunner.getTracer();
    
    const spanId = tracer.startSpan('property_processing', undefined, {
      inputCount: properties.length,
      criteria: JSON.stringify(criteria)
    });

    try {
      // Call the original method
      const processedProperties = super.aggregateAndProcess(properties, criteria);
      
      // Evaluate the ranking quality
      const propertyEvaluator = this.evalRunner.getPropertyEvaluator();
      const evaluation = propertyEvaluator.evaluateSearchResults(
        processedProperties, 
        criteria, 
        0 // Processing time not measured here
      );

      tracer.log(spanId, 'info', 'Property processing completed', {
        inputCount: properties.length,
        outputCount: processedProperties.length,
        duplicatesRemoved: properties.length - processedProperties.length,
        rankingAccuracy: evaluation.rankingAccuracy,
        diversity: evaluation.diversity
      });

      // Log ranking issues
      if (evaluation.rankingAccuracy < 0.8) {
        tracer.log(spanId, 'warn', 'Ranking accuracy below threshold', {
          accuracy: evaluation.rankingAccuracy,
          suggestion: 'Review ranking algorithm weights and criteria'
        });
      }

      tracer.finishSpan(spanId, 'success');
      return processedProperties;
      
    } catch (error) {
      tracer.finishSpan(spanId, 'error', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

// Example 4: Complete Integration in Main Application
export class EnhancedRealEstateApp {
  private evalRunner: EvaluationRunner;
  private tracedAgent: TracedConversationalAgent;
  private tracedApiClient: TracedRealEstateApiClient;
  private tracedPropertyService: TracedPropertyService;

  constructor() {
    this.evalRunner = new EvaluationRunner();
    
    // Initialize traced components
    const memory = new ConversationMemory();
    this.tracedAgent = new TracedConversationalAgent(memory, this.evalRunner);
    this.tracedApiClient = new TracedRealEstateApiClient(this.evalRunner);
    this.tracedPropertyService = new TracedPropertyService(this.evalRunner);
  }

  async runWithEvaluations(): Promise<void> {
    const tracer = this.evalRunner.getTracer();
    
    // Start application-level tracing
    const appSpanId = tracer.startSpan('application_session');
    
    try {
      console.log('🚀 Starting Enhanced Real Estate Agent with Evaluations...\n');
      
      // Start continuous monitoring
      this.evalRunner.startContinuousMonitoring(30); // Every 30 minutes
      
      // Simulate a conversation flow
      await this.simulateConversation();
      
      // Generate evaluation report
      console.log('\n📊 Generating evaluation report...');
      await this.evalRunner.runComprehensiveEvaluation({
        includeConversationEvals: true,
        includePropertyEvals: true,
        includePerformanceTracing: true,
        exportResults: true,
        showInteractiveReport: true
      });
      
      tracer.finishSpan(appSpanId, 'success');
      
    } catch (error) {
      tracer.finishSpan(appSpanId, 'error', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async simulateConversation(): Promise<void> {
    const tracer = this.evalRunner.getTracer();
    
    // Start a conversation trace
    const conversationId = `conv_${Date.now()}`;
    tracer.startConversationTrace(conversationId, 'demo_user');
    
    const testInputs = [
      "I'm looking for a house in Columbus, Ohio",
      "I need 3 bedrooms and 2 bathrooms",
      "My budget is around $400,000 to $500,000",
      "I'd like a garage and a nice yard"
    ];

    for (const input of testInputs) {
      console.log(`User: ${input}`);
      
      const result = await this.tracedAgent.processUserInput(input);
      console.log(`Assistant: ${result.response}`);
      
      if (result.shouldSearch && result.searchCriteria) {
        console.log('\n🔍 Performing property search...');
        
        const properties = await this.tracedApiClient.searchProperties(result.searchCriteria);
        const processedProperties = this.tracedPropertyService.aggregateAndProcess(
          properties, 
          result.searchCriteria
        );
        
        console.log(`Found ${processedProperties.length} properties\n`);
      }
      
      // Small delay to simulate user thinking time
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Finish conversation trace
    tracer.finishConversationTrace(conversationId, 0.9); // Mock user satisfaction
  }

  // Method to access evaluation dashboard
  async showEvaluationDashboard(): Promise<void> {
    const report = this.evalRunner.getTracer().generatePerformanceReport();
    console.log(report);
  }

  // Method to export all traces and evaluations
  async exportAllData(): Promise<void> {
    const tracer = this.evalRunner.getTracer();
    const traces = tracer.exportTraces('json');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `complete-trace-export-${timestamp}.json`;
    
    const fs = await import('fs');
    fs.writeFileSync(filename, traces);
    
    console.log(`📄 Complete trace data exported to: ${filename}`);
  }
}

// Example 5: Standalone Evaluation Script
export async function runStandaloneEvaluation(): Promise<void> {
  console.log('🧪 Running Standalone AI Agent Evaluation\n');
  
  const evalRunner = new EvaluationRunner();
  
  try {
    // Run comprehensive evaluation
    const report = await evalRunner.runComprehensiveEvaluation();
    
    // Show summary
    console.log('\n📋 Evaluation Summary:');
    console.log(`Overall Score: ${(report.summary.overallScore * 100).toFixed(1)}%`);
    console.log(`Issues Found: ${report.issues.length}`);
    console.log(`Recommendations: ${report.recommendations.length}`);
    
    // Show critical issues
    const criticalIssues = report.issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      console.log('\n🚨 Critical Issues:');
      criticalIssues.forEach(issue => {
        console.log(`- ${issue.description}`);
        console.log(`  💡 ${issue.suggestion}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Evaluation failed:', error);
  }
}

// Usage example for testing
if (require.main === module) {
  // Run the enhanced application
  const app = new EnhancedRealEstateApp();
  app.runWithEvaluations().catch(console.error);
} 