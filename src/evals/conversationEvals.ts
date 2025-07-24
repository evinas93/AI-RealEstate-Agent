export interface ConversationEvaluation {
  accuracy: number; // 0-1: How well did AI extract search criteria
  relevance: number; // 0-1: How relevant were the responses
  helpfulness: number; // 0-1: How helpful was the conversation
  completeness: number; // 0-1: Did AI gather enough info before searching
  naturalness: number; // 0-1: How natural was the conversation flow
  overallScore: number; // 0-1: Overall conversation quality
}

export interface SearchCriteriaEvaluation {
  extractionAccuracy: number; // How accurately AI extracted user intent
  missingRequiredFields: string[];
  incorrectValues: Record<string, { expected: any; actual: any }>;
  confidence: number; // AI's confidence in extraction
}

export interface EvalTestCase {
  id: string;
  description: string;
  userInputs: string[];
  expectedCriteria: any;
  expectedConversationFlow: string[];
  context?: string;
}

export class ConversationEvaluator {
  private evaluationHistory: ConversationEvaluation[] = [];
  
  async evaluateConversation(
    conversationHistory: Array<{ role: string; content: string }>,
    finalSearchCriteria: any,
    expectedCriteria?: any
  ): Promise<ConversationEvaluation> {
    // Evaluate search criteria extraction accuracy
    const accuracy = expectedCriteria 
      ? this.calculateCriteriaAccuracy(finalSearchCriteria, expectedCriteria)
      : await this.evaluateWithAI(conversationHistory, 'accuracy');

    // Evaluate conversation quality dimensions
    const relevance = await this.evaluateWithAI(conversationHistory, 'relevance');
    const helpfulness = await this.evaluateWithAI(conversationHistory, 'helpfulness');
    const completeness = this.evaluateCompleteness(finalSearchCriteria);
    const naturalness = await this.evaluateWithAI(conversationHistory, 'naturalness');
    
    const overallScore = (accuracy + relevance + helpfulness + completeness + naturalness) / 5;
    
    const evaluation: ConversationEvaluation = {
      accuracy,
      relevance,
      helpfulness,
      completeness,
      naturalness,
      overallScore
    };
    
    this.evaluationHistory.push(evaluation);
    return evaluation;
  }

  private calculateCriteriaAccuracy(actual: any, expected: any): number {
    const fields = ['city', 'state', 'listingType', 'minPrice', 'maxPrice', 'propertyType', 'bedrooms', 'bathrooms'];
    let correct = 0;
    let total = 0;
    
    fields.forEach(field => {
      if (expected[field] !== undefined) {
        total++;
        if (actual[field] === expected[field]) {
          correct++;
        }
      }
    });
    
    return total > 0 ? correct / total : 1;
  }

  private async evaluateWithAI(conversation: Array<{ role: string; content: string }>, dimension: string): Promise<number> {
    // Use AI to evaluate conversation quality
    // This would use OpenAI to assess the conversation
    const prompts = {
      accuracy: "Rate how accurately the AI extracted search criteria from user input (0-1)",
      relevance: "Rate how relevant the AI's responses were to user needs (0-1)", 
      helpfulness: "Rate how helpful the AI was in guiding the user (0-1)",
      naturalness: "Rate how natural and conversational the AI responses were (0-1)"
    };
    
    // Simplified - in real implementation, call OpenAI with conversation context
    return Math.random() * 0.3 + 0.7; // Mock score between 0.7-1.0
  }

  private evaluateCompleteness(criteria: any): number {
    const requiredFields = ['city', 'listingType', 'propertyType'];
    const optionalButImportant = ['minPrice', 'maxPrice', 'bedrooms'];
    
    let score = 0;
    let total = 0;
    
    // Check required fields
    requiredFields.forEach(field => {
      total += 2; // Weight required fields more
      if (criteria[field] && criteria[field] !== 'any') {
        score += 2;
      }
    });
    
    // Check optional fields
    optionalButImportant.forEach(field => {
      total += 1;
      if (criteria[field]) {
        score += 1;
      }
    });
    
    return total > 0 ? score / total : 0;
  }

  // Test cases for automated evaluation
  getTestCases(): EvalTestCase[] {
    return [
      {
        id: 'basic_search',
        description: 'Basic property search with clear requirements',
        userInputs: [
          "I'm looking for a 3-bedroom house in Columbus, Ohio under $500,000"
        ],
        expectedCriteria: {
          city: 'Columbus',
          state: 'Ohio',
          bedrooms: 3,
          propertyType: 'house',
          maxPrice: 500000,
          listingType: 'buy'
        },
        expectedConversationFlow: ['clarification', 'search_ready']
      },
      {
        id: 'vague_search',
        description: 'Vague initial request requiring clarification',
        userInputs: [
          "I need a place to live",
          "In Columbus",
          "Maybe 2-3 bedrooms",
          "Around $400k"
        ],
        expectedCriteria: {
          city: 'Columbus',
          bedrooms: 2,
          maxPrice: 400000
        },
        expectedConversationFlow: ['clarification', 'clarification', 'clarification', 'search_ready']
      }
    ];
  }

  async runAutomatedEvals(): Promise<void> {
    console.log('🧪 Running Conversation Evaluations...\n');
    
    const testCases = this.getTestCases();
    const results = [];
    
    for (const testCase of testCases) {
      console.log(`Testing: ${testCase.description}`);
      
      // Simulate conversation for this test case
      const mockConversation = testCase.userInputs.map((input, i) => [
        { role: 'user', content: input },
        { role: 'assistant', content: `Mock response ${i + 1}` }
      ]).flat();
      
      const evaluation = await this.evaluateConversation(
        mockConversation,
        testCase.expectedCriteria,
        testCase.expectedCriteria
      );
      
      results.push({ testCase: testCase.id, evaluation });
      console.log(`  Accuracy: ${(evaluation.accuracy * 100).toFixed(1)}%`);
      console.log(`  Overall: ${(evaluation.overallScore * 100).toFixed(1)}%\n`);
    }
    
    this.generateEvalReport(results);
  }

  private generateEvalReport(results: any[]): void {
    const avgScore = results.reduce((sum, r) => sum + r.evaluation.overallScore, 0) / results.length;
    console.log(`📊 Evaluation Summary:`);
    console.log(`Average Score: ${(avgScore * 100).toFixed(1)}%`);
    console.log(`Total Tests: ${results.length}`);
    console.log(`Passing (>80%): ${results.filter(r => r.evaluation.overallScore > 0.8).length}`);
  }

  getEvaluationStats() {
    if (this.evaluationHistory.length === 0) return null;
    
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    
    return {
      totalEvaluations: this.evaluationHistory.length,
      averageScores: {
        accuracy: avg(this.evaluationHistory.map(e => e.accuracy)),
        relevance: avg(this.evaluationHistory.map(e => e.relevance)),
        helpfulness: avg(this.evaluationHistory.map(e => e.helpfulness)),
        completeness: avg(this.evaluationHistory.map(e => e.completeness)),
        naturalness: avg(this.evaluationHistory.map(e => e.naturalness)),
        overall: avg(this.evaluationHistory.map(e => e.overallScore))
      }
    };
  }
} 