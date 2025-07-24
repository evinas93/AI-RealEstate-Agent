import inquirer from 'inquirer';
import chalk from 'chalk';
import { EvaluationRunner } from '../evals/evalRunner';
import { DisplayUtils } from '../utils/display';

export class EvaluationCommands {
  private evalRunner: EvaluationRunner;
  private displayUtils: DisplayUtils;

  constructor() {
    this.evalRunner = new EvaluationRunner();
    this.displayUtils = new DisplayUtils();
  }

  async showEvaluationMenu(): Promise<void> {
    while (true) {
      const choices = [
        { name: '🔍 Run Comprehensive Evaluation', value: 'comprehensive' },
        { name: '🤖 Test Conversation Quality', value: 'conversation' },
        { name: '🏠 Test Property Search', value: 'property' },
        { name: '📊 View Performance Dashboard', value: 'dashboard' },
        { name: '📈 View Score Trends', value: 'trends' },
        { name: '🔄 Start Continuous Monitoring', value: 'monitor' },
        { name: '🛑 Stop Monitoring', value: 'stop_monitor' },
        { name: '📄 Export Traces', value: 'export' },
        { name: '⬅️ Back to Main Menu', value: 'back' }
      ];

      const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'Select evaluation action:',
        choices
      }]);

      switch (action) {
        case 'comprehensive':
          await this.runComprehensiveEvaluation();
          break;
        case 'conversation':
          await this.testConversationQuality();
          break;
        case 'property':
          await this.testPropertySearch();
          break;
        case 'dashboard':
          await this.showPerformanceDashboard();
          break;
        case 'trends':
          await this.showScoreTrends();
          break;
        case 'monitor':
          await this.startContinuousMonitoring();
          break;
        case 'stop_monitor':
          this.evalRunner.stopContinuousMonitoring();
          break;
        case 'export':
          await this.exportTraces();
          break;
        case 'back':
          return;
      }

      // Pause before showing menu again
      await this.waitForKeyPress();
    }
  }

  private async runComprehensiveEvaluation(): Promise<void> {
    const options = await this.getEvaluationOptions();
    console.log(chalk.blue('\n🚀 Starting comprehensive evaluation...\n'));
    
    try {
      const report = await this.evalRunner.runComprehensiveEvaluation(options);
      
      console.log(chalk.green('\n✅ Evaluation completed successfully!'));
      console.log(chalk.gray(`📄 Report saved with timestamp: ${report.timestamp}`));
      
    } catch (error) {
      console.error(chalk.red('\n❌ Evaluation failed:'), error);
    }
  }

  private async testConversationQuality(): Promise<void> {
    console.log(chalk.blue('\n🤖 Running Conversation Quality Tests...\n'));
    
    const evaluator = this.evalRunner.getConversationEvaluator();
    await evaluator.runAutomatedEvals();
    
    const stats = evaluator.getEvaluationStats();
    if (stats) {
      console.log(chalk.bold('\n📊 Conversation Quality Results:'));
      console.log(`Total Evaluations: ${stats.totalEvaluations}`);
      console.log(`Accuracy: ${(stats.averageScores.accuracy * 100).toFixed(1)}%`);
      console.log(`Relevance: ${(stats.averageScores.relevance * 100).toFixed(1)}%`);
      console.log(`Helpfulness: ${(stats.averageScores.helpfulness * 100).toFixed(1)}%`);
      console.log(`Naturalness: ${(stats.averageScores.naturalness * 100).toFixed(1)}%`);
      console.log(`Overall Score: ${(stats.averageScores.overall * 100).toFixed(1)}%`);
    }
  }

  private async testPropertySearch(): Promise<void> {
    console.log(chalk.blue('\n🏠 Running Property Search Tests...\n'));
    
    const evaluator = this.evalRunner.getPropertyEvaluator();
    await evaluator.runSearchBenchmarks();
    
    const stats = evaluator.getSearchPerformanceStats();
    if (stats) {
      console.log(chalk.bold('\n📊 Property Search Results:'));
      console.log(`Total Searches: ${stats.totalSearches}`);
      console.log(`Relevance: ${(stats.averageScores.relevance * 100).toFixed(1)}%`);
      console.log(`Diversity: ${(stats.averageScores.diversity * 100).toFixed(1)}%`);
      console.log(`Completeness: ${(stats.averageScores.completeness * 100).toFixed(1)}%`);
      console.log(`Freshness: ${(stats.averageScores.freshness * 100).toFixed(1)}%`);
      console.log(`Overall Score: ${(stats.averageScores.overall * 100).toFixed(1)}%`);
    }
  }

  private async showPerformanceDashboard(): Promise<void> {
    console.log(chalk.blue('\n📊 Performance Dashboard\n'));
    
    const tracer = this.evalRunner.getTracer();
    const report = tracer.generatePerformanceReport();
    console.log(report);
    
    // Show additional real-time stats
    const conversationStats = tracer.getConversationStats();
    const apiStats = tracer.getApiStats();
    
    console.log(chalk.bold('\n🔄 Real-time Statistics:'));
    console.log(`Active Conversations: ${conversationStats.totalConversations}`);
    console.log(`Average AI Response Time: ${conversationStats.averageAiResponseTime.toFixed(0)}ms`);
    
    console.log(chalk.bold('\n🌐 API Health:'));
    Object.entries(apiStats).forEach(([apiName, stats]) => {
      const healthIcon = stats.successRate > 0.9 ? '🟢' : stats.successRate > 0.7 ? '🟡' : '🔴';
      console.log(`${healthIcon} ${apiName}: ${(stats.successRate * 100).toFixed(1)}% success rate`);
    });
  }

  private async showScoreTrends(): Promise<void> {
    console.log(chalk.blue('\n📈 Score Trends\n'));
    
    const trends = this.evalRunner.getScoreTrends();
    const history = this.evalRunner.getEvaluationHistory();
    
    if (history.length === 0) {
      console.log(chalk.yellow('No evaluation history available. Run some evaluations first.'));
      return;
    }
    
    console.log(chalk.bold('Recent Score Trends (last 10 evaluations):'));
    
    const recentTrends = {
      overall: trends.overall.slice(-10),
      conversation: trends.conversation.slice(-10),
      propertySearch: trends.propertySearch.slice(-10),
      performance: trends.performance.slice(-10)
    };
    
    // Simple ASCII trend visualization
    Object.entries(recentTrends).forEach(([metric, scores]) => {
      if (scores.length > 0) {
        const latest = scores[scores.length - 1];
        const trend = scores.length > 1 
          ? scores[scores.length - 1] - scores[scores.length - 2]
          : 0;
        
        const trendIcon = trend > 0.05 ? '📈' : trend < -0.05 ? '📉' : '➡️';
        const scoreColor = this.getScoreColor(latest);
        
        console.log(`${trendIcon} ${metric}: ${scoreColor((latest * 100).toFixed(1))}% (${scores.length} data points)`);
      }
    });
    
    // Show recent evaluation timestamps
    console.log(chalk.bold('\n📅 Recent Evaluations:'));
    history.slice(-5).forEach((report, i) => {
      const date = new Date(report.timestamp).toLocaleString();
      const scoreColor = this.getScoreColor(report.summary.overallScore);
      console.log(`  ${i + 1}. ${date} - Overall: ${scoreColor((report.summary.overallScore * 100).toFixed(1))}%`);
    });
  }

  private async startContinuousMonitoring(): Promise<void> {
    const { interval } = await inquirer.prompt([{
      type: 'list',
      name: 'interval',
      message: 'Select monitoring interval:',
      choices: [
        { name: 'Every 15 minutes', value: 15 },
        { name: 'Every 30 minutes', value: 30 },
        { name: 'Every hour', value: 60 },
        { name: 'Every 2 hours', value: 120 }
      ]
    }]);
    
    this.evalRunner.startContinuousMonitoring(interval);
  }

  private async exportTraces(): Promise<void> {
    const { format } = await inquirer.prompt([{
      type: 'list',
      name: 'format',
      message: 'Select export format:',
      choices: [
        { name: 'JSON (detailed)', value: 'json' },
        { name: 'CSV (summary)', value: 'csv' }
      ]
    }]);
    
    try {
      const tracer = this.evalRunner.getTracer();
      const data = tracer.exportTraces(format);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `traces-${timestamp}.${format}`;
      
      const fs = await import('fs');
      fs.writeFileSync(filename, data);
      
      console.log(chalk.green(`✅ Traces exported to: ${filename}`));
      console.log(chalk.gray(`File size: ${(data.length / 1024).toFixed(1)} KB`));
      
    } catch (error) {
      console.error(chalk.red('❌ Export failed:'), error);
    }
  }

  private async getEvaluationOptions() {
    const { options } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'options',
      message: 'Select evaluation components:',
      choices: [
        { name: 'Conversation Quality Evaluation', value: 'conversation', checked: true },
        { name: 'Property Search Evaluation', value: 'property', checked: true },
        { name: 'Performance Tracing', value: 'performance', checked: true },
        { name: 'Export Results to File', value: 'export', checked: true },
        { name: 'Show Interactive Report', value: 'interactive', checked: true }
      ]
    }]);

    return {
      includeConversationEvals: options.includes('conversation'),
      includePropertyEvals: options.includes('property'),
      includePerformanceTracing: options.includes('performance'),
      exportResults: options.includes('export'),
      showInteractiveReport: options.includes('interactive')
    };
  }

  private getScoreColor(score: number) {
    if (score >= 0.8) return chalk.green;
    if (score >= 0.6) return chalk.yellow;
    return chalk.red;
  }

  private async waitForKeyPress(): Promise<void> {
    console.log(chalk.gray('\nPress any key to continue...'));
    await inquirer.prompt([{
      type: 'input',
      name: 'continue',
      message: ''
    }]);
  }

  // Method to get the evaluation runner instance for integration
  getEvaluationRunner(): EvaluationRunner {
    return this.evalRunner;
  }
} 