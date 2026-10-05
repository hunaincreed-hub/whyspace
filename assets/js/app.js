import { ModelProvider } from './ai/modelProvider.js';
import { ChatController } from './ai/chatController.js';
import { ChatView } from './ui/chatView.js';

const root = document.querySelector('.main-panel');
const appShell = document.querySelector('.app-shell');
const sidebar = document.querySelector('.sidebar');
const settingsDialog = document.querySelector('#settings-dialog');
const historyConfirmation = document.querySelector('#history-confirmation');

let sidebarOpen = !window.matchMedia('(max-width: 900px)').matches;
let pendingDelete = null;

const setTheme = (theme) => {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('whyspace-theme', theme);
  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
  });
};

const initialiseTheme = () => {
  const savedTheme = localStorage.getItem('whyspace-theme');
  const preferredTheme = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  setTheme(savedTheme || preferredTheme);
};

const setSidebarState = (nextState) => {
  sidebarOpen = Boolean(nextState);
  const isMobile = window.matchMedia('(max-width: 900px)').matches;
  sidebar?.classList.toggle('is-open', isMobile && sidebarOpen);
  appShell?.classList.toggle('sidebar-visible', isMobile && sidebarOpen);
  appShell?.classList.toggle('sidebar-collapsed', !sidebarOpen && !isMobile);

  const openButtons = document.querySelectorAll('[data-sidebar-open]');
  const closeButtons = document.querySelectorAll('[data-sidebar-close]');

  openButtons.forEach((button) => {
    button.hidden = sidebarOpen;
    button.setAttribute('aria-expanded', String(sidebarOpen));
    button.setAttribute('aria-label', sidebarOpen ? 'Close sidebar' : 'Open sidebar');
    button.title = sidebarOpen ? 'Close sidebar' : 'Open sidebar';
    const icon = button.querySelector('span');
    if (icon) icon.textContent = sidebarOpen ? '×' : '☰';
  });

  closeButtons.forEach((button) => {
    button.hidden = !sidebarOpen;
    button.setAttribute('aria-expanded', String(sidebarOpen));
    button.setAttribute('aria-label', 'Close sidebar');
    button.title = 'Close sidebar';
  });
};

const openSidebar = () => setSidebarState(true);
const closeSidebar = () => setSidebarState(false);

const hideDeleteConfirmation = () => {
  if (!historyConfirmation) return;
  historyConfirmation.hidden = true;
  pendingDelete = null;
};

const showDeleteConfirmation = ({ mode, conversationId = null, anchor }) => {
  if (!historyConfirmation) return;
  pendingDelete = { mode, conversationId };
  historyConfirmation.hidden = false;

  const title = historyConfirmation.querySelector('[data-confirm-title]');
  const description = historyConfirmation.querySelector('[data-confirm-description]');
  const action = historyConfirmation.querySelector('[data-confirm-action]');

  if (title) title.textContent = mode === 'all' ? 'Delete all conversations?' : 'Delete this conversation?';
  if (description) description.textContent = mode === 'all' ? 'All saved conversations will be removed.' : 'This conversation will be permanently deleted.';
  if (action) action.textContent = mode === 'all' ? 'Delete all' : 'Delete';

  if (anchor) {
    const card = historyConfirmation.querySelector('.history-confirmation-card');
    if (card) {
      const rect = anchor.getBoundingClientRect();
      const cardWidth = card.offsetWidth || 260;
      const cardHeight = card.offsetHeight || 130;
      const left = Math.min(window.innerWidth - cardWidth - 16, Math.max(16, rect.left + rect.width / 2 - cardWidth / 2));
      const top = Math.max(16, rect.top - cardHeight - 12);
      card.style.left = `${left}px`;
      card.style.top = `${top}px`;
    }
  }
};

if (root) {
  initialiseTheme();

  const modelProvider = new ModelProvider();
  const chatController = new ChatController({ modelProvider });
  const chatView = new ChatView({
    root,
    onSend: async (prompt, options) => {
      const pendingResponse = chatController.sendMessage(prompt, options);
      renderHistory();
      try {
        return await pendingResponse;
      } finally {
        renderHistory();
      }
    },
    onRetry: (prompt, options) => chatController.retryLastMessage(prompt, options),
    onConversationChanged: () => renderHistory()
  });

  const setView = (viewName, { focusComposer = false } = {}) => {
    const visiblePanel = viewName === 'chat' ? 'home' : viewName;
    root.dataset.activeView = viewName;
    const pageContext = document.querySelector('#page-context');
    if (pageContext) pageContext.textContent = viewName === 'chat' ? 'Conversation' : viewName[0].toUpperCase() + viewName.slice(1);
    document.querySelectorAll('[data-view-panel]').forEach((panel) => {
      const isActive = panel.dataset.viewPanel === visiblePanel;
      panel.hidden = !isActive;
      panel.classList.toggle('active', isActive);
    });
    document.querySelectorAll('[data-view]').forEach((button) => {
      const isActive = button.dataset.view === viewName;
      button.classList.toggle('active', isActive);
      button.toggleAttribute('aria-current', isActive);
    });
    if (focusComposer) window.setTimeout(() => chatView.focusInput(), 0);
  };

  root.dataset.activeView = 'home';
  const welcomeHeading = document.querySelector('#home-heading');
  if (welcomeHeading) welcomeHeading.textContent = 'What are you curious about?';
  const welcomeSupport = document.querySelector('.welcome-intro > p:last-child');
  if (welcomeSupport) welcomeSupport.textContent = 'Ask a question, explore an idea, or think something through.';
  const welcomeIdentity = document.querySelector('.welcome-intro .eyebrow');
  if (welcomeIdentity) welcomeIdentity.textContent = 'A place where curiosity lives';
  const emptyMessage = document.querySelector('.message-bubble.welcome');
  if (emptyMessage) emptyMessage.textContent = 'What’s on your mind?';

  const historyList = document.querySelector('#history-list');
  const renderHistory = () => {
    if (!historyList) return;
    historyList.replaceChildren();
    const items = [...chatController.conversations].reverse();

    if (!items.length) {
      const emptyState = document.createElement('div');
      emptyState.className = 'history-empty';
      emptyState.textContent = 'No saved conversations yet';
      historyList.appendChild(emptyState);
      return;
    }

    items.forEach((conversation) => {
      const row = document.createElement('div');
      row.className = 'history-item-row';
      row.classList.toggle('active', conversation.id === chatController.currentConversation.id);

      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'history-item';
      item.dataset.conversationId = conversation.id;
      item.classList.toggle('active', conversation.id === chatController.currentConversation.id);
      item.innerHTML = `<span></span><small>${new Date(conversation.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small>`;
      item.querySelector('span').textContent = conversation.title || 'New conversation';

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'history-delete-button';
      deleteButton.dataset.deleteConversationId = conversation.id;
      deleteButton.setAttribute('aria-label', `Delete ${conversation.title || 'New conversation'}`);
      deleteButton.innerHTML = '<span aria-hidden="true">🗑</span>';

      row.append(item, deleteButton);
      historyList.appendChild(row);
    });
  };

  const confirmDeleteAction = () => {
    if (!pendingDelete) {
      hideDeleteConfirmation();
      return;
    }

    if (pendingDelete.mode === 'all') {
      chatController.deleteAllConversations();
      chatView.reset();
      setView('home');
    } else if (pendingDelete.conversationId) {
      const isCurrent = pendingDelete.conversationId === chatController.currentConversation.id;
      chatController.deleteConversation(pendingDelete.conversationId);
      if (isCurrent) {
        chatView.reset();
        setView('home');
      }
    }

    renderHistory();
    hideDeleteConfirmation();
  };

  document.querySelectorAll('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      setView(button.dataset.view);
      if (window.matchMedia('(max-width: 900px)').matches) closeSidebar();
    });
  });

  document.querySelectorAll('.brand-row, .brand-inline').forEach((brand) => {
    brand.addEventListener('click', (event) => {
      event.preventDefault();
      setView('home');
    });
  });

  document.querySelectorAll('[data-focus-composer]').forEach((button) => {
    button.addEventListener('click', () => setView('home', { focusComposer: true }));
  });

  document.querySelectorAll('[data-new-chat]').forEach((button) => {
    button.addEventListener('click', () => {
      chatController.startNewConversation();
      chatView.reset();
      setView('home', { focusComposer: true });
      closeSidebar();
      renderHistory();
    });
  });

  renderHistory();

  historyList?.addEventListener('click', (event) => {
    const deleteButton = event.target.closest('[data-delete-conversation-id]');
    if (deleteButton) {
      event.preventDefault();
      event.stopPropagation();
      showDeleteConfirmation({ mode: 'single', conversationId: deleteButton.dataset.deleteConversationId, anchor: deleteButton });
      return;
    }

    const item = event.target.closest('.history-item');
    if (!item) return;

    const conversation = chatController.conversations.find(({ id }) => id === item.dataset.conversationId);
    if (!conversation) return;
    chatController.currentConversation = conversation;
    chatView.reset();
    chatView.loadMessages(conversation.messages);
    setView('home');
    if (window.matchMedia('(max-width: 900px)').matches) closeSidebar();
  });

  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });
  });

  document.querySelectorAll('[data-open-settings]').forEach((button) => {
    button.addEventListener('click', () => {
      settingsDialog?.showModal();
      if (window.matchMedia('(max-width: 900px)').matches) closeSidebar();
    });
  });
  document.querySelectorAll('[data-close-settings]').forEach((button) => {
    button.addEventListener('click', () => settingsDialog?.close());
  });
  document.querySelectorAll('[data-delete-all-conversations]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      showDeleteConfirmation({ mode: 'all', anchor: button });
    });
  });
  document.querySelectorAll('[data-confirm-cancel]').forEach((button) => {
    button.addEventListener('click', hideDeleteConfirmation);
  });
  document.querySelectorAll('[data-confirm-action]').forEach((button) => {
    button.addEventListener('click', confirmDeleteAction);
  });

  document.querySelectorAll('[data-sidebar-open]').forEach((button) => {
    button.addEventListener('click', () => {
      if (sidebarOpen) closeSidebar();
      else openSidebar();
    });
  });
  document.querySelectorAll('[data-sidebar-close]').forEach((button) => button.addEventListener('click', closeSidebar));

  const conversationSearch = document.querySelector('#conversation-search');
  conversationSearch?.addEventListener('input', () => {
    const term = conversationSearch.value.trim().toLowerCase();
    document.querySelectorAll('.history-item-row').forEach((row) => {
      const text = row.textContent.toLowerCase();
      row.hidden = Boolean(term) && !text.includes(term);
    });
  });

  window.addEventListener('resize', () => setSidebarState(sidebarOpen));
  window.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === ',') {
      event.preventDefault();
      settingsDialog?.showModal();
    }
    if (event.key === 'Escape') {
      if (historyConfirmation && !historyConfirmation.hidden) {
        hideDeleteConfirmation();
        return;
      }
      closeSidebar();
    }
  });

  window.addEventListener('click', (event) => {
    if (!historyConfirmation || historyConfirmation.hidden) return;
    const card = historyConfirmation.querySelector('.history-confirmation-card');
    if (!card) return;
    if (!card.contains(event.target) && !event.target.closest('[data-delete-conversation-id]') && !event.target.closest('[data-delete-all-conversations]')) {
      hideDeleteConfirmation();
    }
  });

  setSidebarState(sidebarOpen);
}
