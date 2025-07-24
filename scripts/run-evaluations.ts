#!/usr/bin/env ts-node

/**
 * Quick Demo Script for AI Real Estate Agent Evaluations & Tracing
 * 
 * This script demonstrates the evaluation and tracing capabilities
 * Run with: ts-node scripts/run-evaluations.ts
 */

import { EvaluationRunner } from '../src/evals/evalRunner';
import chalk from 'chalk';

async function runDemo() {
  console.log(chalk.blue.bold('🚀 AI Real Estate Agent - Evaluation Demo\n'));
  
  const evalRunner = new EvaluationRunner();
  
  try {
    // 1. Run comprehensive evaluation
    console.log(chalk.yellow('1️⃣ Running Comprehensive Evaluation...\n'));
    const report = await evalRunner.runComprehensiveEvaluation({
      includeConversationEvals: true,
      includePropertyEvals: true,
      includePerformanceTracing: true,
      exportResults: true,
      showInteractiveReport: true
    });
    
    // 2. Show summary
    console.log(chalk.green('\n✅ Evaluation Complete!\n'));
    console.log(chalk.bold('📋 Quick Summary:'));
    console.log(`Overall Score: ${chalk.cyan((report.summary.overallScore * 100).toFixed(1))}%`);
    console.log(`Issues Found: ${chalk.yellow(report.issues.length)}`);
    console.log(`Recommendations: ${chalk.blue(report.recommendations.length)}`);
    
    // 3. Show critical issues if any
    const criticalIssues = report.issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      console.log(chalk.red.bold('\n🚨 Critical Issues Found:'));
      criticalIssues.forEach(issue => {
        console.log(chalk.red(`❌ ${issue.description}`));
        console.log(chalk.gray(`   💡 ${issue.suggestion}`));
      });
    } else {
      console.log(chalk.green('\n✅ No critical issues found!'));
    }
    
    // 4. Start monitoring (demo only - stop after 2 minutes)
    console.log(chalk.blue('\n2️⃣ Starting Continuous Monitoring (demo mode)...\n'));
    evalRunner.startContinuousMonitoring(1); // Every 1 minute for demo
    
    console.log(chalk.gray('Monitoring started. Will run for 2 minutes then stop...'));
    
    // Stop monitoring after 2 minutes for demo
    setTimeout(() => {
      evalRunner.stopContinuousMonitoring();
      console.log(chalk.blue('\n🛑 Demo monitoring stopped.'));
      
      // 5. Show final performance report
      console.log(chalk.yellow('\n3️⃣ Final Performance Report:\n'));
      const performanceReport = evalRunner.getTracer().generatePerformanceReport();
      console.log(performanceReport);
      
      console.log(chalk.green.bold('\n🎉 Demo Complete!'));
      console.log(chalk.gray('\nTo integrate into your app:'));
      console.log(chalk.gray('1. Import EvaluationRunner into your main app'));
      console.log(chalk.gray('2. Add evaluation commands to your CLI menu'));
      console.log(chalk.gray('3. Use traced versions of your classes'));
      console.log(chalk.gray('4. Set up continuous monitoring\n'));
      
    }, 2 * 60 * 1000); // 2 minutes
    
  } catch (error) {
    console.error(chalk.red('\n❌ Demo failed:'), error);
    process.exit(1);
  }
}

// Run the demo if this script is executed directly
if (require.main === module) {
  runDemo().catch(error => {
    console.error(chalk.red('Demo error:'), error);
    process.exit(1);
  });
}

export { runDemo }; 