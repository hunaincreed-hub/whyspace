const MAX_PROMPT_LENGTH = 600;
const MAX_INPUT_HEIGHT = 144;

export class ChatView {
  constructor({ root, onSend, onRetry, onConversationChanged }) {
    this.root = root;
    this.onSend = onSend;
    this.onRetry = onRetry || onSend;
    this.onConversationChanged = onConversationChanged;
    this.input = root.querySelector('#prompt');
    this.form = root.querySelector('#generator-form');
    this.searchToggle = root.querySelector('#search-web-toggle');
    this.status = root.querySelector('#status');
    this.characterCount = root.querySelector('#prompt-count');
    this.messagesPanel = root.querySelector('.messages');
    this.chatStage = root.querySelector('.chat-stage');
    this.shouldFollowMessages = true;
    this.requestId = 0;
    this.input?.removeAttribute('maxlength');
    this.updateConversationLayout();
    this.bind();
    this.updatePromptState();
  }

  bind() {
    this.input?.addEventListener('input', () => {
      this.input.style.height = 'auto';
      this.input.style.height = `${Math.min(this.input.scrollHeight, MAX_INPUT_HEIGHT)}px`;
      this.updatePromptState();
    });
    this.input?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        this.submit();
      }
    });
    this.form?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.submit();
    });
    this.searchToggle?.addEventListener('click', () => {
      const enabled = this.searchToggle.getAttribute('aria-pressed') !== 'true';
      this.searchToggle.setAttribute('aria-pressed', String(enabled));
      this.searchToggle.classList.toggle('active', enabled);
    });
    this.messagesPanel?.addEventListener('click', async (event) => {
      const copyButton = event.target.closest('[data-copy-code], [data-copy-response], [data-retry]');
      if (!copyButton) return;
      if (copyButton.hasAttribute('data-retry')) {
        await this.retryMessage(copyButton.closest('.message-row'));
        return;
      }
      const content = copyButton.hasAttribute('data-copy-response')
        ? copyButton.closest('.message-row')?.dataset.rawResponse || ''
        : copyButton.dataset.copyCode || '';
      try {
        await navigator.clipboard.writeText(content);
        this.showCopyFeedback(copyButton, 'Copied');
      } catch {
        this.showCopyFeedback(copyButton, 'Copy failed');
      }
    });
    this.messagesPanel?.addEventListener('scroll', () => {
      this.shouldFollowMessages = this.isNearBottom();
    }, { passive: true });
    this.root.querySelectorAll('[data-prompt]').forEach((button) => {
      button.addEventListener('click', () => {
        if (!this.input) return;
        this.input.value = button.dataset.prompt || '';
        this.updatePromptState();
        this.focusInput();
      });
    });
  }

  getCurrentPrompt() {
    return String(this.input?.value || '').trim();
  }

  updatePromptState() {
    const prompt = this.getCurrentPrompt();
    const submitButton = this.form?.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = !prompt || prompt.length > MAX_PROMPT_LENGTH || submitButton.getAttribute('aria-busy') === 'true';
    }
    if (this.characterCount) {
      this.characterCount.textContent = `${prompt.length} / ${MAX_PROMPT_LENGTH}`;
      this.characterCount.dataset.state = prompt.length > MAX_PROMPT_LENGTH ? 'error' : 'idle';
    }
  }

  async submit() {
    if (!this.input || !this.form) return;
    const submitButton = this.form.querySelector('button[type="submit"]');
    if (submitButton?.getAttribute('aria-busy') === 'true') return;
    const prompt = this.getCurrentPrompt();
    if (!prompt) {
      this.renderStatus('Write a prompt first so WHYspace can help you.', 'error');
      return;
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
      this.renderStatus(`Keep your prompt to ${MAX_PROMPT_LENGTH} characters or fewer.`, 'error');
      this.updatePromptState();
      return;
    }

    submitButton?.setAttribute('aria-busy', 'true');
    this.form.setAttribute('aria-busy', 'true');
    const searchWeb = this.searchToggle?.getAttribute('aria-pressed') === 'true';
    this.searchToggle?.setAttribute('aria-pressed', 'false');
    this.searchToggle?.classList.remove('active');
    this.renderStatus('WHYspace is thinking…', 'loading');
    const requestId = ++this.requestId;
    this.input.value = '';
    this.input.style.height = 'auto';
    this.updatePromptState();
    this.renderMessage('user', prompt);
    const thinkingRow = this.renderThinking();

    try {
      const result = await this.onSend(prompt, {
        searchWeb,
        onResearchStatus: (_status, message) => {
          if (requestId === this.requestId) this.renderStatus(message, 'loading');
        }
      });
      if (requestId !== this.requestId) return;
      thinkingRow.remove();
      if (!result.ok) {
        this.renderFailure(prompt, null, result);
        this.onConversationChanged?.();
        return;
      }
      this.renderMessage('assistant', result.text, { sources: result.sources, research: result.research });
      this.onConversationChanged?.();
      if (result.persistenceWarning) this.renderStatus('This conversation could not be saved on this device.', 'error');
      else this.renderStatus('', 'idle');
    } catch (error) {
      if (requestId !== this.requestId) return;
      thinkingRow.remove();
      this.renderFailure(prompt, null, { error });
    } finally {
      if (requestId === this.requestId) {
        submitButton?.removeAttribute('aria-busy');
        this.form.removeAttribute('aria-busy');
        this.updatePromptState();
      }
    }
  }

  renderThinking() {
    const row = document.createElement('div');
    row.className = 'message-row assistant thinking-row';
    row.setAttribute('aria-live', 'polite');
    row.innerHTML = '<div class="assistant-identity"><span class="assistant-spark" aria-hidden="true">✦</span><span>WHYspace</span></div><div class="thinking-indicator" role="status" aria-label="WHYspace is thinking"><span></span><span></span><span></span></div>';
    this.messagesPanel?.appendChild(row);
    this.updateConversationLayout();
    if (this.shouldFollowMessages) this.scrollToLatest();
    return row;
  }

  renderStatus(message, type) {
    if (!this.status) return;
    this.status.textContent = message;
    this.status.dataset.state = type;
  }

  renderMessage(role, content, { scroll = true, sources = [], research = null } = {}) {
    const panel = document.createElement('div');
    panel.className = `message-row ${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    if (role === 'assistant') {
      panel.insertAdjacentHTML('afterbegin', '<div class="assistant-identity"><span class="assistant-spark" aria-hidden="true">✦</span><span>WHYspace</span></div>');
      bubble.classList.add('rich-message');
      bubble.innerHTML = this.renderMarkdown(content, sources);
      panel.dataset.rawResponse = content;
    } else {
      bubble.textContent = content;
    }
    panel.appendChild(bubble);
    if (role === 'assistant') {
      if (research?.attempted && research.available && sources.length) {
        const researchLabel = document.createElement('div');
        researchLabel.className = 'research-label';
        researchLabel.textContent = 'Web research · excerpts';
        panel.appendChild(researchLabel);
        const sourceList = document.createElement('section');
        sourceList.className = 'source-list';
        sourceList.setAttribute('aria-label', 'Sources');
        const sourceHeading = document.createElement('h3');
        sourceHeading.textContent = 'Sources';
        sourceList.appendChild(sourceHeading);
        sources.forEach((source) => {
          const link = document.createElement('a');
          link.className = 'source-link';
          link.href = source.url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = source.title;
          const details = document.createElement('span');
          details.textContent = [source.publisher, source.publishedAt ? `Published ${source.publishedAt}` : null, source.snippet].filter(Boolean).join(' · ');
          link.appendChild(details);
          sourceList.appendChild(link);
        });
        if (research.retrievedAt) {
          const retrieval = document.createElement('p');
          retrieval.className = 'source-retrieval-date';
          retrieval.textContent = `Retrieved ${new Date(research.retrievedAt).toLocaleString()}`;
          sourceList.appendChild(retrieval);
        }
        panel.appendChild(sourceList);
      } else if (research?.attempted) {
        const researchNotice = document.createElement('div');
        researchNotice.className = 'research-notice';
        researchNotice.textContent = research.error
          ? `Live web search was unavailable: ${research.error}`
          : 'No relevant web results were returned. This answer was not verified against live sources.';
        panel.appendChild(researchNotice);
      }
      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.className = 'message-action';
      copyButton.dataset.copyResponse = '';
      copyButton.setAttribute('aria-label', 'Copy WHYspace response');
      copyButton.textContent = 'Copy';
      panel.appendChild(copyButton);
    }
    this.messagesPanel?.appendChild(panel);
    this.updateConversationLayout();
    if (scroll && (role === 'user' || this.shouldFollowMessages)) {
      this.scrollToLatest(role === 'user' ? panel : null);
      this.shouldFollowMessages = true;
    }
  }

  isNearBottom() {
    if (!this.messagesPanel) return true;
    return this.messagesPanel.scrollHeight - this.messagesPanel.clientHeight - this.messagesPanel.scrollTop < 100;
  }

  scrollToLatest(target = null) {
    if (!this.messagesPanel) return;
    if (target) target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    else this.messagesPanel.scrollTo({ top: this.messagesPanel.scrollHeight, behavior: 'smooth' });
  }

  showCopyFeedback(button, message) {
    const originalText = button.textContent;
    button.textContent = message;
    button.disabled = true;
    window.setTimeout(() => {
      if (!button.isConnected) return;
      button.textContent = originalText;
      button.disabled = false;
    }, 1400);
  }

  renderFailure(prompt, row = null, result = null) {
    if (!this.messagesPanel) return;
    const errorRow = row || document.createElement('div');
    errorRow.className = 'message-row assistant error-row';
    errorRow.replaceChildren();
    errorRow.insertAdjacentHTML('afterbegin', '<div class="assistant-identity"><span class="assistant-spark" aria-hidden="true">✦</span><span>WHYspace</span></div>');
    const errorMessage = document.createElement('div');
    errorMessage.className = 'message-bubble error-message';
      errorMessage.textContent = result?.persistenceWarning
      ? 'Your message could not be saved on this device. Check available storage, then retry.'
      : result?.code === 'SEARCH_PROVIDER_UNAVAILABLE'
        ? 'Live web search is temporarily unavailable. No current web-verified answer was generated.'
        : result?.error || 'WHYspace could not finish that response. Your message is saved here; you can retry.';
    const retryButton = document.createElement('button');
    retryButton.type = 'button';
    retryButton.className = 'message-action retry-action';
    retryButton.dataset.retry = '';
    retryButton.setAttribute('aria-label', 'Retry response');
    retryButton.textContent = 'Retry';
    errorRow.retryPrompt = prompt;
    errorRow.append(errorMessage, retryButton);
    if (!row) this.messagesPanel.appendChild(errorRow);
    this.renderStatus('Response unavailable. Your message is ready to retry.', 'error');
    this.updateConversationLayout();
    if (this.shouldFollowMessages) this.scrollToLatest();
  }

  async retryMessage(row) {
    if (!row?.retryPrompt || this.form?.getAttribute('aria-busy') === 'true') return;
    const prompt = row.retryPrompt;
    const retryButton = row.querySelector('[data-retry]');
    retryButton.disabled = true;
    this.form?.setAttribute('aria-busy', 'true');
    this.form?.querySelector('button[type="submit"]')?.setAttribute('aria-busy', 'true');
    this.renderStatus('WHYspace is thinking…', 'loading');
    const requestId = ++this.requestId;
    const thinkingRow = this.renderThinking();
    try {
      const result = await this.onRetry(prompt, {
        onResearchStatus: (_status, message) => {
          if (requestId === this.requestId) this.renderStatus(message, 'loading');
        }
      });
      if (requestId !== this.requestId) return;
      thinkingRow.remove();
      if (!result.ok) {
        this.renderFailure(prompt, row, result);
        return;
      }
      row.remove();
      this.renderMessage('assistant', result.text);
      this.onConversationChanged?.();
      if (result.persistenceWarning) this.renderStatus('This conversation could not be saved on this device.', 'error');
      else this.renderStatus('', 'idle');
    } catch (error) {
      if (requestId !== this.requestId) return;
      thinkingRow.remove();
      this.renderFailure(prompt, row, { error });
    } finally {
      if (requestId === this.requestId && this.form?.getAttribute('aria-busy') === 'true') {
        this.form.removeAttribute('aria-busy');
        this.form.querySelector('button[type="submit"]')?.removeAttribute('aria-busy');
        this.updatePromptState();
      }
    }
  }

  updateConversationLayout() {
    const hasMessages = Boolean(this.messagesPanel?.querySelector('.message-row:not(.initial)'));
    if (this.chatStage) {
      this.chatStage.dataset.conversationState = hasMessages ? 'active' : 'empty';
      this.chatStage.querySelector('.welcome-intro')?.setAttribute('aria-hidden', String(hasMessages));
    }
  }

  renderMarkdown(markdown, sources = []) {
    const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
    const safeInline = (value) => {
      const linkTokens = [];
      const protectedLinks = escapeHtml(value)
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
          const token = `WHYSPACE_LINK_${linkTokens.length}`;
          linkTokens.push(`<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
          return token;
        })
        .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
      return protectedLinks.replace(/\[(\d+)\]/g, (match, number) => {
        const source = sources[Number(number) - 1];
        if (!source || !/^https?:\/\//i.test(source.url)) return match;
        const token = `WHYSPACE_CITATION_${linkTokens.length}`;
        linkTokens.push(`<a class="inline-citation" href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer" aria-label="Source ${number}: ${escapeHtml(source.title)}">[${number}]</a>`);
        return token;
      }).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/_([^_]+)_/g, '<em>$1</em>').replace(/WHYSPACE_LINK_(\d+)/g, (_, index) => linkTokens[Number(index)]).replace(/WHYSPACE_CITATION_(\d+)/g, (_, index) => linkTokens[Number(index)]);
    };
    const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
    const output = [];
    let index = 0;
    while (index < lines.length) {
      const line = lines[index];
      if (/^```/.test(line)) {
        const language = line.slice(3).trim();
        const code = [];
        index += 1;
        while (index < lines.length && !/^```/.test(lines[index])) code.push(lines[index++]);
        const label = language ? `<span class="code-language">${escapeHtml(language)}</span>` : '';
        output.push(`<div class="code-block"><div class="code-toolbar">${label}<button type="button" class="copy-code" data-copy-code="${escapeHtml(code.join('\n'))}" aria-label="Copy code">Copy</button></div><pre><code>${escapeHtml(code.join('\n'))}</code></pre></div>`);
        index += 1;
        continue;
      }
      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) output.push(`<h${heading[1].length}>${safeInline(heading[2])}</h${heading[1].length}>`);
      else if (/^\s*>\s?/.test(line)) {
        const quote = [];
        while (index < lines.length && /^\s*>\s?/.test(lines[index])) quote.push(`<p>${safeInline(lines[index++].replace(/^\s*>\s?/, ''))}</p>`);
        output.push(`<blockquote>${quote.join('')}</blockquote>`);
        continue;
      } else if (/^\s*[-*+]\s+/.test(line)) {
        const items = [];
        while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) items.push(`<li>${safeInline(lines[index++].replace(/^\s*[-*+]\s+/, ''))}</li>`);
        output.push(`<ul>${items.join('')}</ul>`);
        continue;
      } else if (/^\s*\d+\.\s+/.test(line)) {
        const items = [];
        while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) items.push(`<li>${safeInline(lines[index++].replace(/^\s*\d+\.\s+/, ''))}</li>`);
        output.push(`<ol>${items.join('')}</ol>`);
        continue;
      } else if (line.trim()) output.push(`<p>${safeInline(line)}</p>`);
      index += 1;
    }
    return output.join('') || '<p class="empty-response">WHYspace returned an empty response.</p>';
  }

  focusInput() {
    if (!this.input) return;
    this.input.focus();
    this.input.style.height = 'auto';
    this.input.style.height = `${Math.min(this.input.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }

  reset() {
    this.requestId += 1;
    this.shouldFollowMessages = true;
    this.messagesPanel?.querySelectorAll('.message-row:not(.initial)').forEach((message) => message.remove());
    this.updateConversationLayout();
    if (this.input) {
      this.input.value = '';
      this.input.style.height = 'auto';
    }
    this.form?.removeAttribute('aria-busy');
    this.searchToggle?.setAttribute('aria-pressed', 'false');
    this.searchToggle?.classList.remove('active');
    this.form?.querySelector('button[type="submit"]')?.removeAttribute('aria-busy');
    this.renderStatus('Ready when you are.', 'idle');
    this.updatePromptState();
  }

  loadMessages(messages) {
    this.shouldFollowMessages = true;
    this.messagesPanel?.querySelectorAll('.message-row:not(.initial)').forEach((message) => message.remove());
    messages.forEach(({ role, content, sources, research }) => this.renderMessage(role, content, { scroll: false, sources, research }));
    if (messages.length) this.messagesPanel?.scrollTo({ top: this.messagesPanel.scrollHeight });
    this.updateConversationLayout();
  }
}
