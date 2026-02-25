import { ChatOllama } from "@langchain/ollama";
import { createAgent } from "langchain";
import { tools, setMarkdownPreviewCallback } from './tools.js';
import { HumanMessage } from "@langchain/core/messages";

const READ_TOOLS = tools.filter(t => t.name === 'read_file');
const GENERATE_TOOLS = tools.filter(t => t.name === 'update_documentation');

export const AGENT_MODES = {
  ANALYZE_GENERATE: 'analyze-generate',
  DOCUMENT_REFINER: 'document-refiner',
  HELP: 'help',
};

export class Agent {
  static create(modelName, baseUrl, onMarkdownPreview, onEvent) {
    if (onMarkdownPreview) {
      setMarkdownPreviewCallback(onMarkdownPreview);
    }

    const llm = new ChatOllama({
      model: modelName,
      baseUrl,
    });

    const wrapTool = (toolList) => {
      return toolList.map(tool => {
        const originalInvoke = tool.invoke.bind(tool);
        tool.invoke = async (input) => {
          if (onEvent) {
            onEvent({ type: 'tool_call', content: `Using tool: ${tool.name}` });
          }
          const result = await originalInvoke(input);
          if (onEvent) {
            onEvent({ type: 'tool_result', content: `Tool ${tool.name} completed` });
          }
          return result;
        };
        return tool;
      });
    };

    const readerAgent = createAgent({
      model: llm,
      tools: wrapTool(READ_TOOLS),
    });

    const generatorAgent = createAgent({
      model: llm,
      tools: wrapTool(GENERATE_TOOLS),
    });

    const helpAgent = createAgent({
      model: llm,
    });

    return {
      invoke: async (input, mode = AGENT_MODES.ANALYZE_GENERATE) => {
        const userMessage = input.messages[0].content;

        if (mode === AGENT_MODES.DOCUMENT_REFINER) {
          return await this.runRefinerMode(generatorAgent, userMessage, onEvent);
        } else if (mode === AGENT_MODES.ANALYZE_GENERATE) {
          return await this.runAnalyzeGenerateMode(readerAgent, generatorAgent, userMessage, onEvent);
        }

        return await this.runHelpMode(helpAgent, userMessage, onEvent);
      }
    };
  }

  static async runAnalyzeGenerateMode(readerAgent, generatorAgent, userMessage, onEvent) {
    if (onEvent) {
      onEvent({ type: 'thinking', content: 'Reading files...' });
    }

    const readPrompt = `You are a file reader. Read all the files the user has uploaded.
Files to read: ${userMessage}
After reading all files, respond with "DONE" and summarize what you read.`;

    let readResult;
    try {
      readResult = await readerAgent.invoke({
        messages: [new HumanMessage(readPrompt)],
      });
    } catch (err) {
      console.error('Reader agent error:', err);
    }

    if (onEvent) {
      onEvent({ type: 'thinking', content: 'Generating documentation...' });
    }

    const generatePrompt = `You are a documentation writer. Based on the file contents above, write comprehensive markdown documentation.

IMPORTANT: You MUST call the update_documentation tool with the complete markdown content.
Call it NOW with your generated documentation.`;

    let generateResult;
    try {
      generateResult = await generatorAgent.invoke({
        messages: [
          ...(readResult?.messages || []),
          new HumanMessage(generatePrompt),
        ],
      });
    } catch (err) {
      console.error('Generator agent error:', err);
    }

    if (onEvent) {
      onEvent({ type: 'completed', content: 'Completed' });
    }

    return {
      messages: generateResult?.messages || [],
    };
  }

  static async runRefinerMode(generatorAgent, userMessage, onEvent) {
    if (onEvent) {
      onEvent({ type: 'thinking', content: 'Refining document...' });
    }

    const refinePrompt = `You are a documentation refiner. The user wants you to improve, edit, or continue their documentation.

User request: ${userMessage}

IMPORTANT: You MUST call the update_documentation tool with the refined documentation content.
Call it NOW with your refined documentation. You should always send the complete documentation (the refined parts + the rest)`;

    let generateResult;
    try {
      generateResult = await generatorAgent.invoke({
        messages: [new HumanMessage(refinePrompt)],
      });
    } catch (err) {
      console.error('Refiner agent error:', err);
    }

    if (onEvent) {
      onEvent({ type: 'completed', content: 'Completed' });
    }

    return {
      messages: generateResult?.messages || [],
    };
  }

  static async runHelpMode(helpAgent, userMessage, onEvent) {
    if (onEvent) {
      onEvent({ type: 'thinking', content: 'Reading application documentation...' });
    }

    const HelpPrompt = `You are a helpful assistant for this Documentation Agent application. Provide helpful answers about how to use the app.

APPLICATION INFORMATION:
- This is a Documentation Agent that helps you analyze documents and generate/refine documentation
- It uses Ollama (local LLM) for AI-powered document processing

AVAILABLE MODES:
1. Analyze & Generate: Upload files (PDF, DOCX, TXT, MD, JSON), the agent reads them and generates documentation
2. Document Refiner: Edit and improve existing documentation in the preview panel
3. Help: Answer questions about how to use this application

HOW THE PREVIEW WORKS:
- The preview shows rendered markdown on a white "paper-like" background
- Click "Edit" to switch to raw markdown editing
- Changes are debounced and saved automatically
- IMPORTANT: Press "Done" to finalize changes before the agent can see them in Document Refiner mode
- Click "Export PDF" to download the documentation as a PDF file
- Click "Clear" to remove the preview

FILE SUPPORT:
- PDF: Uses pdf-parse to extract text
- DOCX: Uses mammoth to extract text
- TXT, MD, JSON: Plain text reading

CHAT WITH THE USER'S QUESTION: ${userMessage}.`;

    let helpResult;
    try {
      helpResult = await helpAgent.invoke({
        messages: [new HumanMessage(HelpPrompt)],
      });
    } catch (err) {
      console.error('Help agent error:', err);
    }

    if (onEvent) {
      onEvent({ type: 'completed', content: 'Completed' });
    }

    return {
      messages: helpResult?.messages || [],
    };
  }
}
