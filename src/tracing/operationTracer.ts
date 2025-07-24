export interface TraceSpan {
  id: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'running' | 'success' | 'error' | 'timeout';
  parentSpanId?: string;
  tags: Record<string, any>;
  logs: TraceLog[];
  error?: string;
  metadata: Record<string, any>;
}

export interface TraceLog {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: any;
}

export interface ConversationTrace {
  conversationId: string;
  userId?: string;
  startTime: number;
  endTime?: number;
  totalMessages: number;
  searchesPerformed: number;
  aiResponseTimes: number[];
  extractionAccuracy: number;
  userSatisfaction?: number;
  steps: ConversationStep[];
}

export interface ConversationStep {
  stepId: string;
  type: 'user_input' | 'ai_processing' | 'search_execution' | 'result_display' | 'export';
  startTime: number;
  duration: number;
  input?: string;
  output?: string;
  metadata: Record<string, any>;
}

export interface ApiCallTrace {
  apiName: string;
  endpoint: string;
  method: string;
  startTime: number;
  duration: number;
  status: 'success' | 'error' | 'timeout';
  requestSize?: number;
  responseSize?: number;
  errorMessage?: string;
  rateLimited: boolean;
  retryAttempts: number;
}

export class OperationTracer {
  private activeSpans: Map<string, TraceSpan> = new Map();
  private completedSpans: TraceSpan[] = [];
  private conversationTraces: Map<string, ConversationTrace> = new Map();
  private apiCallTraces: ApiCallTrace[] = [];
  private maxSpanHistory = 1000;

  // Core Span Management
  startSpan(operationName: string, parentSpanId?: string, tags: Record<string, any> = {}): string {
    const spanId = this.generateSpanId();
    const span: TraceSpan = {
      id: spanId,
      operationName,
      startTime: Date.now(),
      status: 'running',
      parentSpanId,
      tags: { ...tags },
      logs: [],
      metadata: {}
    };

    this.activeSpans.set(spanId, span);
    this.log(spanId, 'info', `Started operation: ${operationName}`, tags);
    
    return spanId;
  }

  finishSpan(spanId: string, status: 'success' | 'error' = 'success', error?: string): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;
    if (error) span.error = error;

    this.log(spanId, status === 'success' ? 'info' : 'error', 
      `Finished operation: ${span.operationName} (${span.duration}ms)`, 
      { duration: span.duration, status }
    );

    this.activeSpans.delete(spanId);
    this.completedSpans.push(span);

    // Cleanup old spans
    if (this.completedSpans.length > this.maxSpanHistory) {
      this.completedSpans.shift();
    }
  }

  log(spanId: string, level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.logs.push({
      timestamp: Date.now(),
      level,
      message,
      data
    });

    // Also log to console for immediate feedback
    const prefix = `[${span.operationName}:${spanId.substring(0, 8)}]`;
    switch (level) {
      case 'debug':
        console.debug(`${prefix} ${message}`, data || '');
        break;
      case 'info':
        console.log(`${prefix} ${message}`, data || '');
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`, data || '');
        break;
      case 'error':
        console.error(`${prefix} ${message}`, data || '');
        break;
    }
  }

  addSpanTag(spanId: string, key: string, value: any): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.tags[key] = value;
    }
  }

  // Conversation Tracing
  startConversationTrace(conversationId: string, userId?: string): void {
    const trace: ConversationTrace = {
      conversationId,
      userId,
      startTime: Date.now(),
      totalMessages: 0,
      searchesPerformed: 0,
      aiResponseTimes: [],
      extractionAccuracy: 0,
      steps: []
    };

    this.conversationTraces.set(conversationId, trace);
  }

  addConversationStep(
    conversationId: string, 
    type: ConversationStep['type'], 
    input?: string, 
    output?: string, 
    metadata: Record<string, any> = {}
  ): string {
    const trace = this.conversationTraces.get(conversationId);
    if (!trace) return '';

    const stepId = this.generateStepId();
    const step: ConversationStep = {
      stepId,
      type,
      startTime: Date.now(),
      duration: 0, // Will be updated when step completes
      input,
      output,
      metadata
    };

    trace.steps.push(step);
    if (type === 'user_input' || type === 'ai_processing') {
      trace.totalMessages++;
    }

    return stepId;
  }

  completeConversationStep(conversationId: string, stepId: string, output?: string): void {
    const trace = this.conversationTraces.get(conversationId);
    if (!trace) return;

    const step = trace.steps.find(s => s.stepId === stepId);
    if (step) {
      step.duration = Date.now() - step.startTime;
      if (output) step.output = output;

      // Track AI response times
      if (step.type === 'ai_processing') {
        trace.aiResponseTimes.push(step.duration);
      }

      // Track searches
      if (step.type === 'search_execution') {
        trace.searchesPerformed++;
      }
    }
  }

  finishConversationTrace(conversationId: string, userSatisfaction?: number): void {
    const trace = this.conversationTraces.get(conversationId);
    if (!trace) return;

    trace.endTime = Date.now();
    trace.userSatisfaction = userSatisfaction;

    // Calculate average extraction accuracy from steps
    const aiSteps = trace.steps.filter(s => s.type === 'ai_processing');
    if (aiSteps.length > 0) {
      const accuracies = aiSteps
        .map(s => s.metadata.extractionAccuracy)
        .filter(a => typeof a === 'number');
      if (accuracies.length > 0) {
        trace.extractionAccuracy = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
      }
    }
  }

  // API Call Tracing
  traceApiCall(
    apiName: string,
    endpoint: string,
    method: string = 'GET',
    metadata: Record<string, any> = {}
  ): {
    complete: (status: 'success' | 'error' | 'timeout', error?: string) => void;
    setRequestSize: (size: number) => void;
    setResponseSize: (size: number) => void;
    setRetryAttempts: (attempts: number) => void;
  } {
    const startTime = Date.now();
    let trace: ApiCallTrace = {
      apiName,
      endpoint,
      method,
      startTime,
      duration: 0,
      status: 'success',
      rateLimited: false,
      retryAttempts: 0
    };

    return {
      complete: (status: 'success' | 'error' | 'timeout', error?: string) => {
        trace.duration = Date.now() - startTime;
        trace.status = status;
        if (error) trace.errorMessage = error;
        
        // Check for rate limiting indicators
        if (error && (error.includes('rate limit') || error.includes('429'))) {
          trace.rateLimited = true;
        }
        
        this.apiCallTraces.push(trace);
        
        // Keep only recent API traces
        if (this.apiCallTraces.length > this.maxSpanHistory) {
          this.apiCallTraces.shift();
        }
      },
      setRequestSize: (size: number) => { trace.requestSize = size; },
      setResponseSize: (size: number) => { trace.responseSize = size; },
      setRetryAttempts: (attempts: number) => { trace.retryAttempts = attempts; }
    };
  }

  // Query and Analysis Methods
  getSpansByOperation(operationName: string): TraceSpan[] {
    return this.completedSpans.filter(span => span.operationName === operationName);
  }

  getSlowSpans(thresholdMs: number = 1000): TraceSpan[] {
    return this.completedSpans.filter(span => 
      span.duration && span.duration > thresholdMs
    );
  }

  getErrorSpans(): TraceSpan[] {
    return this.completedSpans.filter(span => span.status === 'error');
  }

  getConversationStats(): {
    totalConversations: number;
    averageMessageCount: number;
    averageAiResponseTime: number;
    averageSearchesPerConversation: number;
    averageExtractionAccuracy: number;
  } {
    const traces = Array.from(this.conversationTraces.values());
    if (traces.length === 0) {
      return {
        totalConversations: 0,
        averageMessageCount: 0,
        averageAiResponseTime: 0,
        averageSearchesPerConversation: 0,
        averageExtractionAccuracy: 0
      };
    }

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const allResponseTimes = traces.flatMap(t => t.aiResponseTimes);

    return {
      totalConversations: traces.length,
      averageMessageCount: avg(traces.map(t => t.totalMessages)),
      averageAiResponseTime: allResponseTimes.length > 0 ? avg(allResponseTimes) : 0,
      averageSearchesPerConversation: avg(traces.map(t => t.searchesPerformed)),
      averageExtractionAccuracy: avg(traces.map(t => t.extractionAccuracy).filter(a => a > 0))
    };
  }

  getApiStats(): Record<string, {
    callCount: number;
    averageResponseTime: number;
    successRate: number;
    errorRate: number;
    rateLimitRate: number;
  }> {
    const stats: Record<string, any> = {};

    // Group by API name
    const groupedTraces = this.apiCallTraces.reduce((acc, trace) => {
      if (!acc[trace.apiName]) acc[trace.apiName] = [];
      acc[trace.apiName].push(trace);
      return acc;
    }, {} as Record<string, ApiCallTrace[]>);

    Object.entries(groupedTraces).forEach(([apiName, traces]) => {
      const successCount = traces.filter(t => t.status === 'success').length;
      const errorCount = traces.filter(t => t.status === 'error').length;
      const rateLimitCount = traces.filter(t => t.rateLimited).length;

      stats[apiName] = {
        callCount: traces.length,
        averageResponseTime: traces.reduce((sum, t) => sum + t.duration, 0) / traces.length,
        successRate: successCount / traces.length,
        errorRate: errorCount / traces.length,
        rateLimitRate: rateLimitCount / traces.length
      };
    });

    return stats;
  }

  // Export trace data
  exportTraces(format: 'json' | 'csv' = 'json'): string {
    const data = {
      metadata: {
        exportTime: new Date().toISOString(),
        spanCount: this.completedSpans.length,
        conversationCount: this.conversationTraces.size,
        apiCallCount: this.apiCallTraces.length
      },
      spans: this.completedSpans,
      conversations: Array.from(this.conversationTraces.values()),
      apiCalls: this.apiCallTraces
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else {
      // Simple CSV format for spans
      const csvHeaders = 'Operation,Duration,Status,StartTime,EndTime,Error\n';
      const csvRows = this.completedSpans.map(span => 
        `"${span.operationName}",${span.duration || 0},"${span.status}","${new Date(span.startTime).toISOString()}","${span.endTime ? new Date(span.endTime).toISOString() : ''}","${span.error || ''}"`
      ).join('\n');
      return csvHeaders + csvRows;
    }
  }

  // Performance reporting
  generatePerformanceReport(): string {
    const spans = this.completedSpans;
    const conversations = Array.from(this.conversationTraces.values());
    const apiStats = this.getApiStats();
    
    let report = '🔍 Performance Trace Report\n';
    report += '==============================\n\n';
    
    // Span Summary
    report += `📊 Operation Summary:\n`;
    report += `Total Operations: ${spans.length}\n`;
    if (spans.length > 0) {
      const avgDuration = spans.reduce((sum, s) => sum + (s.duration || 0), 0) / spans.length;
      const errorRate = spans.filter(s => s.status === 'error').length / spans.length;
      report += `Average Duration: ${avgDuration.toFixed(1)}ms\n`;
      report += `Error Rate: ${(errorRate * 100).toFixed(1)}%\n\n`;
    }
    
    // Conversation Summary
    if (conversations.length > 0) {
      const conversationStats = this.getConversationStats();
      report += `💬 Conversation Summary:\n`;
      report += `Total Conversations: ${conversationStats.totalConversations}\n`;
      report += `Avg Messages per Conversation: ${conversationStats.averageMessageCount.toFixed(1)}\n`;
      report += `Avg AI Response Time: ${conversationStats.averageAiResponseTime.toFixed(0)}ms\n`;
      report += `Avg Searches per Conversation: ${conversationStats.averageSearchesPerConversation.toFixed(1)}\n\n`;
    }
    
    // API Summary
    report += `🌐 API Performance:\n`;
    Object.entries(apiStats).forEach(([apiName, stats]) => {
      report += `${apiName}:\n`;
      report += `  Calls: ${stats.callCount}\n`;
      report += `  Avg Response Time: ${stats.averageResponseTime.toFixed(0)}ms\n`;
      report += `  Success Rate: ${(stats.successRate * 100).toFixed(1)}%\n`;
      if (stats.rateLimitRate > 0) {
        report += `  Rate Limited: ${(stats.rateLimitRate * 100).toFixed(1)}%\n`;
      }
      report += '\n';
    });
    
    return report;
  }

  private generateSpanId(): string {
    return `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateStepId(): string {
    return `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Cleanup methods
  clearOldTraces(olderThanMs: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - olderThanMs;
    
    // Clear old spans
    this.completedSpans = this.completedSpans.filter(span => span.startTime > cutoff);
    
    // Clear old API traces
    this.apiCallTraces = this.apiCallTraces.filter(trace => trace.startTime > cutoff);
    
    // Clear old conversation traces
    for (const [id, trace] of this.conversationTraces.entries()) {
      if (trace.startTime < cutoff) {
        this.conversationTraces.delete(id);
      }
    }
  }
} 