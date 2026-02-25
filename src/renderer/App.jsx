import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import MDEditor from '@uiw/react-md-editor';
import { jsPDF } from 'jspdf';
import { marked } from 'marked';
import html2canvas from 'html2canvas';
import { Brain, Cog, HelpCircle, FileText, CheckCircle, XCircle, Sparkles, Maximize2, Minimize2, Minus, Sun, Moon } from 'lucide-react';

function App() {
  const [files, setFiles] = useState([]);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hello! I'm ready to help you work with your documents." }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedMode, setSelectedMode] = useState('analyze-generate');
  const [markdownPreview, setMarkdownPreview] = useState('');
  const [isSavingPreview, setIsSavingPreview] = useState(false);
  const [previewHistory, setPreviewHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [agentEvents, setAgentEvents] = useState([]);
  const messagesEndRef = useRef(null);
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    checkOllama();

    if (window.electronAPI?.onMarkdownPreview) {
      window.electronAPI.onMarkdownPreview((markdown) => {
        setMarkdownPreview(markdown);
        window.electronAPI.setMarkdownPreview(markdown);
        
        if (markdown) {
          setPreviewHistory(prev => {
            const exists = prev.some(v => v.content === markdown);
            if (!exists) {
              return [
                { content: markdown, timestamp: new Date().toISOString(), source: 'agent' },
                ...prev.slice(0, 19)
              ];
            }
            return prev;
          });
        }
      });
    }

    if (window.electronAPI?.onAgentEvent) {
      window.electronAPI.onAgentEvent((event) => {
        setAgentEvents(prev => [...prev, event]);
      });
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, agentEvents]);

  useEffect(() => {
    const checkMaximized = async () => {
      if (window.electronAPI?.isMaximized) {
        const maximized = await window.electronAPI.isMaximized();
        setIsMaximized(maximized);
      }
    };
    checkMaximized();
  }, []);

  const handleMaximize = async () => {
    if (window.electronAPI?.maximizeWindow) {
      await window.electronAPI.maximizeWindow();
      const maximized = await window.electronAPI.isMaximized();
      setIsMaximized(maximized);
    }
  };

  const checkOllama = async () => {
    try {
      const result = await window.electronAPI.checkOllama();
      setIsConnected(result.connected);
      if (result.models) {
        setModels(result.models);
      }
      const currentModel = await window.electronAPI.getModel();
      if (currentModel) {
        setSelectedModel(currentModel);
      } else if (result.models && result.models.length > 0) {
        setSelectedModel(result.models[0]);
      }
    } catch (err) {
      console.error('Failed to check Ollama:', err);
    }
  };

  const handleModelChange = async (model) => {
    setSelectedModel(model);
    try {
      await window.electronAPI.setModel(model);
    } catch (err) {
      console.error('Failed to set model:', err);
    }
  };

  const handleSelectFiles = async () => {
    const selectedFiles = await window.electronAPI.selectFiles();
    if (selectedFiles.length > 0) {
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const handleRemoveFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const sendMessage = async (message) => {
    if (!message.trim() || isLoading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    setAgentEvents([]);
    setIsLoading(true);

    try {
      const result = await window.electronAPI.sendMessage(message, files, selectedMode);

      if (result.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: result.error, isError: true }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: result.response }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}`, isError: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = () => sendMessage(input);

  const handleQuickStart = () => {
    if (selectedMode === 'analyze-generate') {
      sendMessage("Start working on the uploaded files. Read them and generate documentation.");
    } else if (selectedMode === 'document-refiner') {
      sendMessage("Improve and refine the current documentation. Make it better, clearer, and more comprehensive.");
    } else if (selectedMode === 'help') {
      sendMessage("Give me a quick overview of how to use this Documentation Agent application.");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const exportToPdf = async () => {
    const container = document.createElement('div');
    container.innerHTML = marked.parse(markdownPreview);
    container.style.cssText = 'position: absolute; left: -9999px; top: 0; width: 800px; padding: 24px; background: white; color: #1a1a1a; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; line-height: 1.6;';
    
    const processElement = (el) => {
      const styles = {
        h1: 'font-size: 1.75em; font-weight: 700; margin: 1em 0 0.25em; padding-bottom: 0.2em; border-bottom: 1px solid #e5e5e5;',
        h2: 'font-size: 1.4em; font-weight: 600; margin: 1em 0 0.25em; padding-bottom: 0.15em; border-bottom: 1px solid #e5e5e5;',
        h3: 'font-size: 1.15em; font-weight: 600; margin: 0.75em 0 0.25em;',
        p: 'margin-bottom: 0.5em;',
        ul: 'margin-bottom: 0.5em; padding-left: 1.5em;',
        ol: 'margin-bottom: 0.5em; padding-left: 1.5em;',
        li: 'margin-bottom: 0.25em;',
        code: 'background-color: #f5f5f5; padding: 0.15em 0.3em; border-radius: 3px; font-family: "SF Mono", Consolas, monospace; font-size: 0.9em; color: #c7254e;',
        pre: 'background-color: #f5f5f5; padding: 0.75em; border-radius: 4px; margin-bottom: 0.5em;',
        blockquote: 'border-left: 3px solid #ddd; padding-left: 0.75em; margin-left: 0; margin-bottom: 0.5em; color: #666;',
        table: 'border-collapse: collapse; width: 100%; margin-bottom: 0.5em;',
        th: 'background-color: #f5f5f5; font-weight: 600; border: 1px solid #ddd; padding: 6px 10px; text-align: left;',
        td: 'border: 1px solid #ddd; padding: 6px 10px; text-align: left;',
      };
      
      const tag = el.tagName.toLowerCase();
      if (styles[tag]) {
        el.style.cssText = styles[tag];
      }
    };
    
    Array.from(container.children).forEach(processElement);
    
    document.body.appendChild(container);

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);
      const scale = 2;
      
      const elements = Array.from(container.children);
      let currentY = margin;
      
      for (const el of elements) {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position: absolute; left: -9999px; width: 800px; background: white;';
        wrapper.appendChild(el.cloneNode(true));
        document.body.appendChild(wrapper);
        
        try {
          const canvas = await html2canvas(wrapper, { 
            scale,
            useCORS: true,
            logging: false
          });
          
          const imgWidth = contentWidth;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          
          if (currentY + imgHeight > pageHeight - margin) {
            pdf.addPage();
            currentY = margin;
          }
          
          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, currentY, imgWidth, imgHeight);
          currentY += imgHeight + 2;
        } finally {
          document.body.removeChild(wrapper);
        }
      }

      pdf.save('document.pdf');
    } finally {
      document.body.removeChild(container);
    }
  };

  const handlePreviewChange = (value) => {
    const newValue = value || '';
    
    setMarkdownPreview(newValue);
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    setIsSavingPreview(true);
    
    debounceTimerRef.current = setTimeout(() => {
      if (window.electronAPI?.setMarkdownPreview) {
        window.electronAPI.setMarkdownPreview(newValue);
      }
      setIsSavingPreview(false);
      
      if (newValue && newValue !== (previewHistory[0]?.content || '')) {
        setPreviewHistory(prev => [
          { content: newValue, timestamp: new Date().toISOString() },
          ...prev.slice(0, 19)
        ]);
      }
    }, 500);
  };

  const handleRestoreVersion = (version) => {
    setMarkdownPreview(version.content);
    if (window.electronAPI?.setMarkdownPreview) {
      window.electronAPI.setMarkdownPreview(version.content);
    }
    setShowHistory(false);
  };

  const handleClearPreview = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setMarkdownPreview("");
    setIsSavingPreview(false);
    if (window.electronAPI?.setMarkdownPreview) {
      window.electronAPI.setMarkdownPreview("");
    }
  };

  const handleSaveProject = async () => {
    if (window.electronAPI?.saveProject) {
      const result = await window.electronAPI.saveProject(markdownPreview);
      if (result.error) {
        console.error('Save error:', result.error);
      }
    }
  };

  const handleLoadProject = async () => {
    if (window.electronAPI?.loadProject) {
      const result = await window.electronAPI.loadProject();
      if (result.success) {
        setMarkdownPreview(result.content);
        if (window.electronAPI?.setMarkdownPreview) {
          window.electronAPI.setMarkdownPreview(result.content);
        }
      } else if (result.error && result.error !== 'Load cancelled') {
        console.error('Load error:', result.error);
      }
    }
  };

  const theme = isDarkMode ? {
    bg: '#171717',
    bgSecondary: '#262626',
    bgTertiary: '#404040',
    text: '#fafafa',
    textSecondary: '#d4d4d4',
    border: '#404040',
    borderSecondary: '#525252',
  } : {
    bg: '#ffffff',
    bgSecondary: '#f5f5f5',
    bgTertiary: '#e5e5e5',
    text: '#171717',
    textSecondary: '#525252',
    border: '#d4d4d4',
    borderSecondary: '#e5e5e5',
  };

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: theme.bg, color: theme.text }} data-theme={isDarkMode ? 'dark' : 'light'}>
      <header className="h-10 flex items-center justify-between border-b select-none" style={{ backgroundColor: theme.bg, borderColor: theme.border, WebkitAppRegion: 'drag' }}>
        <div className="flex items-center px-4 gap-3">
          <h1 className="text-base font-semibold" style={{ color: theme.text }}>Documentation Agent</h1>
          <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' }}>
            <button
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{ backgroundColor: theme.bgTertiary, color: theme.text }}
              onClick={handleLoadProject}
            >
              Load
            </button>
            <button
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{ backgroundColor: theme.bgTertiary, color: theme.text }}
              onClick={handleSaveProject}
            >
              Save
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 px-4" style={{ WebkitAppRegion: 'no-drag' }}>
          <div className="flex items-center gap-2 mr-2 text-xs" style={{ color: theme.textSecondary }}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-600' : 'bg-red-500'}`}></span>
            <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          <button
            className="w-8 h-8 flex items-center justify-center rounded transition-colors"
            style={{ backgroundColor: theme.bgTertiary, color: theme.text }}
            onClick={() => setIsDarkMode(!isDarkMode)}
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            className="w-8 h-8 flex items-center justify-center rounded transition-colors"
            style={{ backgroundColor: theme.bgTertiary, color: theme.text }}
            onClick={() => window.electronAPI.minimizeWindow()}
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            className="w-8 h-8 flex items-center justify-center rounded transition-colors"
            style={{ backgroundColor: theme.bgTertiary, color: theme.text }}
            onClick={handleMaximize}
          >
            {isMaximized ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
          <button
            className="w-8 h-8 flex items-center justify-center rounded transition-colors hover:bg-red-500 hover:text-white"
            style={{ backgroundColor: theme.bgTertiary, color: theme.text }}
            onClick={() => window.electronAPI.closeWindow()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden p-6 gap-6">
        <div className="w-1/2 flex flex-col gap-4 overflow-hidden">
          {selectedMode === 'analyze-generate' && (
            <div className="rounded-xl p-5 flex flex-col gap-3 shadow-sm border" style={{ backgroundColor: theme.bg, borderColor: theme.border }}>
              <h2 className="text-lg font-semibold">Files</h2>
              <div
                className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors"
                style={{ borderColor: theme.border, backgroundColor: theme.bgSecondary }}
                onClick={handleSelectFiles}
              >
                <p className="text-sm" style={{ color: theme.textSecondary }}>Click to upload files</p>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {files.map((file, index) => (
                  <div key={index} className="flex justify-between items-center px-3 py-2 rounded text-sm" style={{ backgroundColor: theme.bgSecondary }}>
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="truncate">{file.name}</span>
                      <span className="text-xs" style={{ color: theme.textSecondary }}>{formatFileSize(file.size)}</span>
                    </div>
                    <button
                      className="px-2"
                      style={{ color: theme.textSecondary }}
                      onClick={() => handleRemoveFile(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl p-5 flex-1 flex flex-col gap-3 overflow-hidden" style={{ backgroundColor: theme.bg, borderColor: theme.border, borderWidth: 1 }}>
            <div className="flex items-center justify-between gap-2 w-full">
              <h2 className="text-lg">Chat</h2>


            </div>
            <div className="flex-1 overflow-y-auto rounded-lg p-4 space-y-3 flex flex-col gap-1" style={{ backgroundColor: theme.bgSecondary }}>
              {messages.map((msg, index) => (
                <div key={index} className="p-2 rounded-lg" style={{ 
                  backgroundColor: msg.role === 'user' ? (isDarkMode ? '#1e3a5f' : '#dbeafe') : theme.bg,
                  border: `1px solid ${msg.isError ? '#fca5a5' : (msg.role === 'user' ? '#93c5fd' : theme.border)}`,
                  color: msg.isError ? '#dc2626' : theme.text
                }}>
                  <div className="text-xs mb-1" style={{ color: msg.isError ? '#dc2626' : theme.textSecondary }}>{msg.role === 'user' ? 'You' : 'Assistant'}</div>
                  <div className="text-sm whitespace-pre-wrap">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              ))}
              {agentEvents.length > 0 && (
                <div className="p-2 rounded-lg" style={{ backgroundColor: isDarkMode ? '#2e1065' : '#f3e8ff', border: `1px solid ${isDarkMode ? '#7e22ce' : '#c084fc'}` }}>
                  <div className="text-xs mb-2 flex items-center gap-1" style={{ color: isDarkMode ? '#d8b4fe' : '#7e22ce' }}>
                    <Sparkles className="w-3 h-3" />
                    Agent Steps
                  </div>
                  {agentEvents.map((event, idx) => (
                    <div key={idx} className="text-xs mb-1 flex items-center gap-1" style={{ color: theme.textSecondary }}>
                      {event.type === 'thinking' && <><Brain className="w-3 h-3" style={{ color: '#eab308' }} /> <span style={{ color: '#eab308' }}>{event.content}</span></>}
                      {event.type === 'tool_call' && <><Cog className="w-3 h-3" /> <span>{event.content}</span></>}
                      {event.type === 'tool_result' && <><CheckCircle className="w-3 h-3" style={{ color: '#22c55e' }} /> <span style={{ color: '#22c55e' }}>{event.content}</span></>}
                      {event.type === 'completed' && <><CheckCircle className="w-3 h-3" style={{ color: '#3b82f6' }} /> <span style={{ color: '#3b82f6' }}>{event.content}</span></>}
                      {event.type === 'error' && <><XCircle className="w-3 h-3" style={{ color: '#ef4444' }} /> <span style={{ color: '#ef4444' }}>{event.content}</span></>}
                    </div>
                  ))}
                </div>
              )}
              {isLoading && (
                <div className="p-2 rounded-lg mr-12" style={{ backgroundColor: theme.bgSecondary }}>
                  <div className="text-xs mb-2" style={{ color: theme.textSecondary }}>Assistant</div>
                  <div className="text-sm">
                    <span className="inline-block w-4 h-4 border-2 border-neutral-400 border-t-white rounded-full animate-spin mr-2"></span>
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="flex gap-3">
              <textarea
                className="flex-1 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none"
                style={{ backgroundColor: theme.bgSecondary, borderColor: theme.border, color: theme.text }}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyUp={handleKeyPress}
                placeholder="Type your message..."
                rows={1}
              />
              <button
                className="w-10 h-10 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: theme.bgTertiary, color: theme.text }}
                onClick={handleSendMessage}
                disabled={isLoading || !input.trim()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                </svg>
              </button>
            </div>

            <div className="flex gap-1 justify-between">

              <button
                className="ml-auto text-xs px-3 py-1 rounded transition-colors"
                style={{ backgroundColor: theme.bgTertiary, color: theme.text }}
                onClick={handleQuickStart}
                disabled={isLoading}
              >
                Quick Start
              </button>

              <div className='flex gap-1 items-center'>
                <span className="text-xs" style={{ color: theme.textSecondary }}>Model:</span>
                <select
                  value={selectedModel}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="rounded px-2 py-1 text-sm"
                  style={{ backgroundColor: theme.bgSecondary, borderColor: theme.border, color: theme.text }}
                >
                  <option value="">Select model...</option>
                  {models.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>

                <span className="text-xs ml-2" style={{ color: theme.textSecondary }}>Mode:</span>
                <select
                  value={selectedMode}
                  onChange={(e) => setSelectedMode(e.target.value)}
                  className="rounded px-2 py-1 text-sm"
                  style={{ backgroundColor: theme.bgSecondary, borderColor: theme.border, color: theme.text, WebkitAppRegion: 'no-drag' }}
                >
                  <option value="analyze-generate">Analyze & Generate</option>
                  <option value="document-refiner">Document Refiner</option>
                  <option value="help">Help</option>
                </select>

              </div>
            </div>
          </div>
        </div>

        <div className="w-1/2">
          <div className="rounded-xl p-5 h-full flex flex-col gap-3" style={{ backgroundColor: theme.bg, borderColor: theme.border, borderWidth: 1 }}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <h2 className="text-lg">Preview</h2>
                {isSavingPreview && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: theme.textSecondary }}>
                    <span className="w-3 h-3 border rounded-full animate-spin"></span>
                    Saving...
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {markdownPreview && (
                  <>
                    <div className="relative">
                      <button
                        className="text-sm px-3 py-1.5 rounded transition-colors"
                        style={{ backgroundColor: theme.bgSecondary, color: theme.text }}
                        onClick={() => setShowHistory(!showHistory)}
                      >
                        History ({previewHistory.length})
                      </button>
                      {showHistory && (
                        <div className="absolute right-0 top-full mt-1 w-64 bg-neutral-100 border border-neutral-300 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                          {previewHistory.length > 0 ? (
                            previewHistory.map((version, index) => (
                              <button
                                key={index}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-200 border-b border-neutral-300 last:border-b-0"
                                onClick={() => handleRestoreVersion(version)}
                              >
                                <div className="text-neutral-700 truncate">
                                  {version.content.substring(0, 50)}...
                                </div>
                                <div className="text-xs" style={{ color: theme.textSecondary }}>
                                  {new Date(version.timestamp).toLocaleTimeString()}
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm" style={{ color: theme.textSecondary }}>No history yet</div>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      className="text-sm px-3 py-1.5 rounded transition-colors"
                      style={{ backgroundColor: theme.bgSecondary, color: theme.text }}
                      onClick={exportToPdf}
                    >
                      Export PDF
                    </button>
                    <button
                      className="text-sm"
                      style={{ color: theme.textSecondary }}
                      onClick={handleClearPreview}
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-hidden rounded-lg" data-color-mode={isDarkMode ? "dark" : "light"}>
              <MDEditor
                value={markdownPreview}
                onChange={handlePreviewChange}
                preview="live"
                height="100%"
                hideToolbar={false}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
