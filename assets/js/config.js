export const appConfig = {
  provider: {
    name: 'openai',
    model: 'gpt-4o-mini',
    apiKey: import.meta.env?.VITE_OPENAI_API_KEY || window?.WHYSPACE_API_KEY || '',
    baseUrl: import.meta.env?.VITE_OPENAI_BASE_URL || 'https://api.openai.com/v1'
  },
  app: {
    name: 'WHYspace',
    tag: 'Curiosity lives here.'
  }
};
