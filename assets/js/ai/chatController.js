export class ChatController {
  constructor({ modelProvider, storageKey = 'whyspace-conversations' }) {
    this.modelProvider = modelProvider;
    this.storageKey = storageKey;
    this.conversations = this.loadConversations();
    this.currentConversation = this.createConversation();
    this.requests = new Map();
  }

  createConversation() {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      title: 'New conversation',
      createdAt: now,
      updatedAt: now,
      model: this.modelProvider.model,
      messages: []
    };
  }

  loadConversations() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
      return Array.isArray(saved) ? saved.filter((conversation) => conversation?.id && Array.isArray(conversation.messages)) : [];
    } catch {
      return [];
    }
  }

  persist() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.conversations.slice(-30)));
      return true;
    } catch {
      return false;
    }
  }

  get history() {
    return this.currentConversation.messages;
  }

  startNewConversation() {
    if (this.currentConversation.messages.length) this.saveCurrentConversation();
    this.currentConversation = this.createConversation();
    return this.currentConversation;
  }

  saveCurrentConversation(conversation = this.currentConversation) {
    if (!conversation.messages.length) return true;
    const existingIndex = this.conversations.findIndex(({ id }) => id === conversation.id);
    if (existingIndex >= 0) this.conversations[existingIndex] = conversation;
    else this.conversations.push(conversation);
    return this.persist();
  }

  deleteConversation(conversationId) {
    this.requests.get(conversationId)?.abort();
    this.requests.delete(conversationId);
    this.conversations = this.conversations.filter(({ id }) => id !== conversationId);
    if (this.currentConversation.id === conversationId) {
      this.currentConversation = this.createConversation();
    }
    this.persist();
    return this.currentConversation;
  }

  deleteAllConversations() {
    this.requests.forEach((controller) => controller.abort());
    this.requests.clear();
    this.conversations = [];
    this.currentConversation = this.createConversation();
    this.persist();
    return this.currentConversation;
  }

  async sendMessage(prompt, { searchWeb = false, onResearchStatus } = {}) {
    const trimmed = String(prompt || '').trim();
    if (!trimmed) {
      return { ok: false, error: 'Please enter a prompt so WHYspace can help you.' };
    }

    const conversation = this.currentConversation;
    if (this.requests.has(conversation.id)) return { ok: false, error: 'WHYspace is still responding to your last message.' };

    conversation.messages.push({ role: 'user', content: trimmed, searchWeb });
    if (conversation.title === 'New conversation') {
      conversation.title = trimmed.slice(0, 46) + (trimmed.length > 46 ? '…' : '');
    }
    conversation.updatedAt = new Date().toISOString();
    const persisted = this.saveCurrentConversation(conversation);
    return this.requestResponse(conversation, !persisted, searchWeb, onResearchStatus);
  }

  async retryLastMessage(prompt, { onResearchStatus } = {}) {
    const conversation = this.currentConversation;
    const lastMessage = conversation.messages.at(-1);
    if (lastMessage?.role !== 'user' || (prompt && lastMessage.content !== prompt)) {
      return { ok: false, error: 'There is no unanswered message to retry.' };
    }
    if (this.requests.has(conversation.id)) return { ok: false, error: 'WHYspace is still responding to your last message.' };
    return this.requestResponse(conversation, false, Boolean(lastMessage.searchWeb), onResearchStatus);
  }

  async requestResponse(conversation, persistenceWarning, searchWeb = false, onResearchStatus) {
    const controller = new AbortController();
    this.requests.set(conversation.id, controller);
    try {
      const result = await this.modelProvider.generateResponse(conversation.messages, { signal: controller.signal, searchWeb, onResearchStatus });
      if (this.requests.get(conversation.id) !== controller) {
        return { ok: false, error: 'This conversation is no longer available.' };
      }
      if (!result?.ok || typeof result.text !== 'string' || !result.text.trim()) {
        return { ok: false, error: result?.error || 'Unable to generate a response right now.', persistenceWarning };
      }

      conversation.messages.push({ role: 'assistant', content: result.text, sources: result.sources || [], research: result.research || null });
      conversation.updatedAt = new Date().toISOString();
      const saved = this.saveCurrentConversation(conversation);
      return { ok: true, text: result.text, model: result.model, streaming: result.streaming, sources: result.sources || [], research: result.research || null, persistenceWarning: persistenceWarning || !saved };
    } catch {
      return { ok: false, error: 'Unable to generate a response right now.', persistenceWarning };
    } finally {
      if (this.requests.get(conversation.id) === controller) this.requests.delete(conversation.id);
    }
  }
}
