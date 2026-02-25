import log from "electron-log";
import { Agent, AGENT_MODES } from "./agent.js";
import { HumanMessage } from "@langchain/core/messages";

export { AGENT_MODES };

export class AgentService {
  constructor(onMarkdownPreview, onEvent) {
    this.ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'qwen3:8b';
    this.agent = null;
    this.isConnected = false;
    this.availableModels = [];
    this.onMarkdownPreview = onMarkdownPreview;
    this.onEvent = onEvent;
    this.currentMarkdownPreview = '';
  }

  setCurrentMarkdownPreview(markdown) {
    this.currentMarkdownPreview = markdown;
  }

  async initialize() {
    try {
      this.agent = Agent.create(this.model, this.ollamaBaseUrl, this.onMarkdownPreview, this.onEvent);
      log.info('LLM initialized with Ollama, model:', this.model);
    } catch (err) {
      log.error('LLM initialization error:', err);
    }
  }

  async setModel(model) {
    this.model = model;
    try {
      this.agent = Agent.create(this.model, this.ollamaBaseUrl, this.onMarkdownPreview, this.onEvent);
      log.info('Model updated to:', model);
      return { success: true, model: this.model };
    } catch (err) {
      log.error('Model update error:', err);
      return { error: err.message };
    }
  }

  getModel() {
    return this.model;
  }

  async checkConnection() {
    try {
      const response = await fetch(`${this.ollamaBaseUrl}/api/tags`);
      if (response.ok) {
        this.isConnected = true;
        const data = await response.json();
        this.availableModels = data.models || [];
        log.info('Ollama connected, models:', this.availableModels.length);
        return {
          connected: true,
          models: this.availableModels.map(m => m.name),
          baseUrl: this.ollamaBaseUrl
        };
      }
      return { connected: false, error: 'Connection failed' };
    } catch (err) {
      this.isConnected = false;
      log.warn('Ollama not reachable:', err.message);
      return { connected: false, error: err.message };
    }
  }

  async getModels() {
    if (!this.isConnected) {
      await this.checkConnection();
    }
    return this.availableModels.map(m => m.name);
  }

  async chat(message, files = [], mode = AGENT_MODES.ANALYZE_GENERATE) {
    if (!this.isConnected) {
      await this.checkConnection();
      if (!this.isConnected) {
        return { error: 'Ollama is not connected. Please ensure Ollama is running.' };
      }
    }

    try {
      let contextMessage;

      if (mode === AGENT_MODES.ANALYZE_GENERATE) {
        const fileContext = files.length > 0
          ? `Files:\n${files.map(f => `- ${f.name} (${f.path})`).join('\n')}`
          : 'No files';

        contextMessage = `Context:\n${fileContext}\n\nUser: ${message}`;
      } else {
        const markdownContext = this.currentMarkdownPreview
          ? `Current document preview:\n${this.currentMarkdownPreview}`
          : 'No document preview';

        contextMessage = `Context:\n${markdownContext}\n\nUser: ${message}`;
      }

      const result = await this.agent.invoke({
        messages: [new HumanMessage(contextMessage)],
      }, mode);

      let content = "No response";
      for (const message of result.messages) {
        if (message.type === "ai") {
          content = message.text;
        }
      }

      return {
        response: content,
        files: files
      };
    } catch (err) {
      log.error('Chat error:', err);
      return { error: err.message };
    }
  }
}

