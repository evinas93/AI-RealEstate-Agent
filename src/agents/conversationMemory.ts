export interface ConversationEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface UserPreferences {
  city?: string;
  state?: string;
  priceRange?: { min?: number; max?: number };
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  features?: string[];
  additionalRequirements?: string[];
}

export interface ConversationSession {
  id: string;
  startTime: Date;
  lastUpdated: Date;
  messages: ConversationEntry[];
  extractedPreferences: UserPreferences;
  searchHistory: any[];
}

export class ConversationMemory {
  private sessions: Map<string, ConversationSession>;
  private currentSessionId: string | null = null;
  private maxConversations: number;

  constructor(maxConversations: number = 10) {
    this.sessions = new Map();
    this.maxConversations = maxConversations;
  }

  startNewSession(): string {
    const sessionId = this.generateSessionId();
    const session: ConversationSession = {
      id: sessionId,
      startTime: new Date(),
      lastUpdated: new Date(),
      messages: [],
      extractedPreferences: {},
      searchHistory: []
    };
    
    this.sessions.set(sessionId, session);
    this.currentSessionId = sessionId;
    
    // Clean up old sessions if we exceed the limit
    if (this.sessions.size > this.maxConversations) {
      const oldestSession = Array.from(this.sessions.entries())
        .sort((a, b) => a[1].lastUpdated.getTime() - b[1].lastUpdated.getTime())[0];
      this.sessions.delete(oldestSession[0]);
    }
    
    return sessionId;
  }

  addMessage(role: 'user' | 'assistant', content: string): void {
    if (!this.currentSessionId) {
      this.startNewSession();
    }
    
    const session = this.sessions.get(this.currentSessionId!);
    if (session) {
      session.messages.push({
        role,
        content,
        timestamp: new Date()
      });
      session.lastUpdated = new Date();
    }
  }

  updatePreferences(preferences: Partial<UserPreferences>): void {
    if (!this.currentSessionId) return;
    
    const session = this.sessions.get(this.currentSessionId);
    if (session) {
      session.extractedPreferences = {
        ...session.extractedPreferences,
        ...preferences
      };
      session.lastUpdated = new Date();
    }
  }

  addSearchResult(searchResult: any): void {
    if (!this.currentSessionId) return;
    
    const session = this.sessions.get(this.currentSessionId);
    if (session) {
      session.searchHistory.push({
        timestamp: new Date(),
        result: searchResult
      });
    }
  }

  getCurrentSession(): ConversationSession | null {
    if (!this.currentSessionId) return null;
    return this.sessions.get(this.currentSessionId) || null;
  }

  getConversationHistory(): ConversationEntry[] {
    const session = this.getCurrentSession();
    return session ? session.messages : [];
  }

  getExtractedPreferences(): UserPreferences {
    const session = this.getCurrentSession();
    return session ? session.extractedPreferences : {};
  }

  getFullContext(): string {
    const session = this.getCurrentSession();
    if (!session) return '';
    
    return session.messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  exportSession(): ConversationSession | null {
    return this.getCurrentSession();
  }

  importSession(session: ConversationSession): void {
    this.sessions.set(session.id, session);
    this.currentSessionId = session.id;
  }
} 