import { ConversationEvaluator, ConversationEvaluation } from './conversationEvals';
import { PropertyEvaluator, PropertySearchEvaluation } from './propertyEvals';
import { OperationTracer } from '../tracing/operationTracer';
import chalk from 'chalk';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface EvaluationReport {
  timestamp: string;
  summary: {
    overallScore: number;
    conversationScore: number;
    propertySearchScore: number;
    performanceScore: number;
  };
  conversationEvals: {
    totalEvaluations: number;
    averageScores: Record<string, number>;
    recentTrends: number[];
  };
  propertyEvals: {
    totalSearches: number;
    averageScores: Record<string, number>;
    apiPerformance: Record<string, any>;
  };
  systemPerformance: {
    operationStats: any;
    conversationStats: any;
    apiStats: Record<string, any>;
  };
  recommendations: string[];
  issues: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: string;
    description: string;
    impact: string;
    suggestion: string;
  }>;
}

export class EvaluationRunner {
  private conversationEvaluator: ConversationEvaluator;
  private propertyEvaluator: PropertyEvaluator;
  private tracer: OperationTracer;
  private evaluationHistory: EvaluationReport[] = [];
  private isRunning = false;

  constructor() {
    this.conversationEvaluator = new ConversationEvaluator();
    this.propertyEvaluator = new PropertyEvaluator();
    this.tracer = new OperationTracer();
  }

  // Main evaluation orchestration
  async runComprehensiveEvaluation(options: {
    includeConversationEvals?: boolean;
    includePropertyEvals?: boolean;
    includePerformanceTracing?: boolean;
    exportResults?: boolean;
    showInteractiveReport?: boolean;
  } = {}): Promise<EvaluationReport> {
    const {
      includeConversationEvals = true,
      includePropertyEvals = true,
      includePerformanceTracing = true,
      exportResults = true,
      showInteractiveReport = true
    } = options;

    console.log(chalk.blue.bold('\n🔍 Starting Comprehensive AI Agent Evaluation\n'));
    console.log(chalk.gray('Evaluating conversation quality, search accuracy, and system performance...\n'));

    const spanId = this.tracer.startSpan('comprehensive_evaluation');

    try {
      const report: EvaluationReport = {
        timestamp: new Date().toISOString(),
        summary: { overallScore: 0, conversationScore: 0, propertySearchScore: 0, performanceScore: 0 },
        conversationEvals: { totalEvaluations: 0, averageScores: {}, recentTrends: [] },
        propertyEvals: { totalSearches: 0, averageScores: {}, apiPerformance: {} },
        systemPerformance: { operationStats: {}, conversationStats: {}, apiStats: {} },
        recommendations: [],
        issues: []
      };

      // 1. Conversation Quality Evaluation
      if (includeConversationEvals) {
        console.log(chalk.yellow('🤖 Evaluating Conversation Quality...'));
        await this.runConversationEvaluations(report);
        console.log(chalk.green('✅ Conversation evaluation complete\n'));
      }

      // 2. Property Search Evaluation
      if (includePropertyEvals) {
        console.log(chalk.yellow('🏠 Evaluating Property Search Performance...'));
        await this.runPropertyEvaluations(report);
        console.log(chalk.green('✅ Property evaluation complete\n'));
      }

      // 3. System Performance Analysis
      if (includePerformanceTracing) {
        console.log(chalk.yellow('📊 Analyzing System Performance...'));
        this.analyzeSystemPerformance(report);
        console.log(chalk.green('✅ Performance analysis complete\n'));
      }

      // 4. Generate insights and recommendations
      this.generateInsightsAndRecommendations(report);

      // 5. Calculate overall scores
      this.calculateOverallScores(report);

      this.evaluationHistory.push(report);

      // 6. Export results
      if (exportResults) {
        this.exportEvaluationReport(report);
      }

      // 7. Show interactive report
      if (showInteractiveReport) {
        this.displayInteractiveReport(report);
      }

      this.tracer.finishSpan(spanId, 'success');
      return report;

    } catch (error) {
      this.tracer.finishSpan(spanId, 'error', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async runConversationEvaluations(report: EvaluationReport): Promise<void> {
    // Run automated conversation evaluations
    await this.conversationEvaluator.runAutomatedEvals();
    
    const stats = this.conversationEvaluator.getEvaluationStats();
    if (stats) {
      report.conversationEvals = {
        totalEvaluations: stats.totalEvaluations,
        averageScores: stats.averageScores,
        recentTrends: this.calculateTrends('conversation')
      };
      report.summary.conversationScore = stats.averageScores.overall;
    }
  }

  private async runPropertyEvaluations(report: EvaluationReport): Promise<void> {
    // Run property search benchmarks
    await this.propertyEvaluator.runSearchBenchmarks();
    
    const stats = this.propertyEvaluator.getSearchPerformanceStats();
    if (stats) {
      report.propertyEvals = {
        totalSearches: stats.totalSearches,
        averageScores: stats.averageScores,
        apiPerformance: this.tracer.getApiStats()
      };
      report.summary.propertySearchScore = stats.averageScores.overall;
    }
  }

  private analyzeSystemPerformance(report: EvaluationReport): void {
    report.systemPerformance = {
      operationStats: this.getOperationStats(),
      conversationStats: this.tracer.getConversationStats(),
      apiStats: this.tracer.getApiStats()
    };

    // Calculate performance score based on response times and error rates
    const apiStats = this.tracer.getApiStats();
    const conversationStats = this.tracer.getConversationStats();
    
    let performanceScore = 1.0;
    
    // Penalize slow API responses
    Object.values(apiStats).forEach((stats: any) => {
      if (stats.averageResponseTime > 2000) performanceScore -= 0.1;
      if (stats.successRate < 0.95) performanceScore -= 0.2;
    });
    
    // Penalize slow AI responses
    if (conversationStats.averageAiResponseTime > 3000) performanceScore -= 0.1;
    
    report.summary.performanceScore = Math.max(0, performanceScore);
  }

  private generateInsightsAndRecommendations(report: EvaluationReport): void {
    const issues = [];
    const recommendations = [];

    // Analyze conversation quality
    if (report.conversationEvals.averageScores.accuracy < 0.8) {
      issues.push({
        severity: 'high' as const,
        category: 'Conversation Quality',
        description: 'AI search criteria extraction accuracy is below 80%',
        impact: 'Users may get irrelevant search results',
        suggestion: 'Improve prompt engineering and add more training examples'
      });
      recommendations.push('Review and enhance AI prompts for better criteria extraction');
    }

    if (report.conversationEvals.averageScores.naturalness < 0.7) {
      issues.push({
        severity: 'medium' as const,
        category: 'User Experience',
        description: 'AI responses lack naturalness',
        impact: 'Poor user experience and engagement',
        suggestion: 'Adjust AI temperature and response templates'
      });
      recommendations.push('Improve AI response naturalness with better prompts');
    }

    // Analyze property search quality
    if (report.propertyEvals.averageScores.relevance < 0.8) {
      issues.push({
        severity: 'high' as const,
        category: 'Search Quality',
        description: 'Property search relevance is below 80%',
        impact: 'Users receive irrelevant property suggestions',
        suggestion: 'Enhance filtering logic and ranking algorithm'
      });
      recommendations.push('Improve property filtering and ranking algorithms');
    }

    if (report.propertyEvals.averageScores.diversity < 0.6) {
      issues.push({
        severity: 'medium' as const,
        category: 'Search Diversity',
        description: 'Low diversity in property search results',
        impact: 'Users see limited variety in property options',
        suggestion: 'Enhance result diversification logic'
      });
      recommendations.push('Implement better result diversification');
    }

    // Analyze API performance
    Object.entries(report.systemPerformance.apiStats).forEach(([apiName, stats]: [string, any]) => {
      if (stats.successRate < 0.9) {
        issues.push({
          severity: 'critical' as const,
          category: 'API Reliability',
          description: `${apiName} API has success rate below 90%`,
          impact: 'Frequent search failures and poor user experience',
          suggestion: 'Implement better error handling and fallbacks'
        });
        recommendations.push(`Improve ${apiName} API reliability and error handling`);
      }

      if (stats.averageResponseTime > 5000) {
        issues.push({
          severity: 'high' as const,
          category: 'Performance',
          description: `${apiName} API response time exceeds 5 seconds`,
          impact: 'Slow search experience for users',
          suggestion: 'Implement caching and optimize API calls'
        });
        recommendations.push(`Optimize ${apiName} API response times`);
      }
    });

    // Analyze conversation performance
    const convStats = report.systemPerformance.conversationStats;
    if (convStats.averageAiResponseTime > 4000) {
      issues.push({
        severity: 'medium' as const,
        category: 'AI Performance',
        description: 'AI response time exceeds 4 seconds',
        impact: 'Slow conversation flow',
        suggestion: 'Optimize AI model usage and implement response caching'
      });
      recommendations.push('Optimize AI response times');
    }

    report.issues = issues;
    report.recommendations = recommendations;
  }

  private calculateOverallScores(report: EvaluationReport): void {
    const weights = {
      conversation: 0.4,
      propertySearch: 0.4,
      performance: 0.2
    };

    report.summary.overallScore = 
      (report.summary.conversationScore * weights.conversation) +
      (report.summary.propertySearchScore * weights.propertySearch) +
      (report.summary.performanceScore * weights.performance);
  }

  private calculateTrends(type: 'conversation' | 'property'): number[] {
    // Calculate score trends over recent evaluations
    const recentReports = this.evaluationHistory.slice(-5);
    if (recentReports.length === 0) return [];

    return recentReports.map(report => {
      if (type === 'conversation') {
        return report.summary.conversationScore;
      } else {
        return report.summary.propertySearchScore;
      }
    });
  }

  private getOperationStats() {
    const slowSpans = this.tracer.getSlowSpans(1000);
    const errorSpans = this.tracer.getErrorSpans();
    
    return {
      slowOperations: slowSpans.length,
      errorOperations: errorSpans.length,
      mostCommonErrors: this.getMostCommonErrors(errorSpans),
      slowestOperations: slowSpans.slice(0, 5).map(span => ({
        operation: span.operationName,
        duration: span.duration
      }))
    };
  }

  private getMostCommonErrors(errorSpans: any[]): Array<{ error: string; count: number }> {
    const errorCounts = errorSpans.reduce((acc, span) => {
      const error = span.error || 'Unknown error';
      acc[error] = (acc[error] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(errorCounts)
      .map(([error, count]) => ({ error, count: count as number }))
      .sort((a, b) => (b.count as number) - (a.count as number))
      .slice(0, 5);
  }

  private exportEvaluationReport(report: EvaluationReport): void {
    const timestamp = report.timestamp.replace(/[:.]/g, '-');
    const filename = `evaluation-report-${timestamp}.json`;
    const evaluationsDir = join(process.cwd(), 'evaluations');
    
    // Ensure evaluations directory exists
    if (!existsSync(evaluationsDir)) {
      mkdirSync(evaluationsDir, { recursive: true });
    }
    
    const filepath = join(evaluationsDir, filename);
    
    writeFileSync(filepath, JSON.stringify(report, null, 2));
    console.log(chalk.green(`📄 Evaluation report exported to: evaluations/${filename}`));
  }

  private displayInteractiveReport(report: EvaluationReport): void {
    console.log(chalk.blue.bold('\n📊 EVALUATION DASHBOARD\n'));
    console.log(chalk.blue('=' .repeat(50)));

    // Overall Score
    const overallColor = this.getScoreColor(report.summary.overallScore);
    console.log(chalk.bold(`\n🎯 Overall Score: ${overallColor((report.summary.overallScore * 100).toFixed(1))}%`));

    // Score Breakdown
    console.log(chalk.bold('\n📈 Score Breakdown:'));
    console.log(`  🤖 Conversation Quality: ${this.getScoreColor(report.summary.conversationScore)((report.summary.conversationScore * 100).toFixed(1))}%`);
    console.log(`  🏠 Property Search: ${this.getScoreColor(report.summary.propertySearchScore)((report.summary.propertySearchScore * 100).toFixed(1))}%`);
    console.log(`  ⚡ Performance: ${this.getScoreColor(report.summary.performanceScore)((report.summary.performanceScore * 100).toFixed(1))}%`);

    // Issues Summary
    if (report.issues.length > 0) {
      console.log(chalk.bold('\n⚠️  Issues Found:'));
      const critical = report.issues.filter(i => i.severity === 'critical').length;
      const high = report.issues.filter(i => i.severity === 'high').length;
      const medium = report.issues.filter(i => i.severity === 'medium').length;
      const low = report.issues.filter(i => i.severity === 'low').length;

      if (critical > 0) console.log(`  🔴 Critical: ${critical}`);
      if (high > 0) console.log(`  🟠 High: ${high}`);
      if (medium > 0) console.log(`  🟡 Medium: ${medium}`);
      if (low > 0) console.log(`  🟢 Low: ${low}`);

      // Show top 3 issues
      console.log(chalk.bold('\n🚨 Top Issues:'));
      report.issues.slice(0, 3).forEach((issue, i) => {
        const severityIcon = this.getSeverityIcon(issue.severity);
        console.log(`  ${i + 1}. ${severityIcon} ${issue.description}`);
        console.log(`     💡 ${chalk.gray(issue.suggestion)}`);
      });
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      console.log(chalk.bold('\n💡 Recommendations:'));
      report.recommendations.slice(0, 5).forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
    }

    // Performance Summary
    console.log(chalk.bold('\n📊 Performance Summary:'));
    const apiStats = report.systemPerformance.apiStats;
    Object.entries(apiStats).forEach(([apiName, stats]: [string, any]) => {
      console.log(`  ${apiName}: ${stats.callCount} calls, ${stats.averageResponseTime.toFixed(0)}ms avg, ${(stats.successRate * 100).toFixed(1)}% success`);
    });

    const convStats = report.systemPerformance.conversationStats;
    console.log(`  AI Response Time: ${convStats.averageAiResponseTime.toFixed(0)}ms avg`);
    console.log(`  Conversations: ${convStats.totalConversations} total`);

    console.log(chalk.blue('\n=' .repeat(50)));
    console.log(chalk.gray(`Report generated at: ${new Date(report.timestamp).toLocaleString()}`));
  }

  private getScoreColor(score: number) {
    if (score >= 0.8) return chalk.green;
    if (score >= 0.6) return chalk.yellow;
    return chalk.red;
  }

  private getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }

  // Continuous monitoring methods
  startContinuousMonitoring(intervalMinutes: number = 30): void {
    if (this.isRunning) {
      console.log(chalk.yellow('Continuous monitoring is already running'));
      return;
    }

    this.isRunning = true;
    console.log(chalk.blue(`🔄 Starting continuous monitoring (every ${intervalMinutes} minutes)`));

    const interval = setInterval(async () => {
      try {
        console.log(chalk.gray('\n🔍 Running scheduled evaluation...'));
        await this.runComprehensiveEvaluation({
          showInteractiveReport: false,
          exportResults: false
        });
      } catch (error) {
        console.error(chalk.red('Scheduled evaluation failed:'), error);
      }
    }, intervalMinutes * 60 * 1000);

    // Store interval reference for cleanup
    (this as any).monitoringInterval = interval;
  }

  stopContinuousMonitoring(): void {
    if ((this as any).monitoringInterval) {
      clearInterval((this as any).monitoringInterval);
      (this as any).monitoringInterval = null;
      this.isRunning = false;
      console.log(chalk.blue('🛑 Stopped continuous monitoring'));
    }
  }

  // Get evaluation history and trends
  getEvaluationHistory(): EvaluationReport[] {
    return [...this.evaluationHistory];
  }

  getScoreTrends(): {
    overall: number[];
    conversation: number[];
    propertySearch: number[];
    performance: number[];
  } {
    return {
      overall: this.evaluationHistory.map(r => r.summary.overallScore),
      conversation: this.evaluationHistory.map(r => r.summary.conversationScore),
      propertySearch: this.evaluationHistory.map(r => r.summary.propertySearchScore),
      performance: this.evaluationHistory.map(r => r.summary.performanceScore)
    };
  }

  // Getter methods for integration
  getTracer(): OperationTracer {
    return this.tracer;
  }

  getConversationEvaluator(): ConversationEvaluator {
    return this.conversationEvaluator;
  }

  getPropertyEvaluator(): PropertyEvaluator {
    return this.propertyEvaluator;
  }
} 