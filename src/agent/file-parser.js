import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import mammoth from 'mammoth';
import { PDFExtract } from 'pdf.js-extract';

const parsers = {
  async pdf(filePath) {
    const pdfExtract = new PDFExtract();
    const data = await pdfExtract.extract(filePath, {});
    const text = data.pages.map(page => {
      return page.content.map(item => item.str).join(' ');
    }).join('\n');
    return {
      text,
      pages: data.pages.length,
      info: data.meta
    };
  },

  async docx(filePath) {
    const result = await mammoth.extractRawText({ path: filePath });
    return {
      text: result.value
    };
  },

  txt(filePath) {
    return {
      text: fs.readFileSync(filePath, 'utf-8')
    };
  },

  log(filePath) {
    return {
      text: fs.readFileSync(filePath, 'utf-8')
    };
  },

  md(filePath) {
    return {
      text: fs.readFileSync(filePath, 'utf-8')
    };
  },

  json(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    return {
      text: JSON.stringify(parsed, null, 2)
    };
  },

  async doc(filePath) {
    return {
      error: 'DOC format is not directly supported. Please convert the file to DOCX or PDF format.'
    };
  }
};

export async function parseFile(filePath, maxChars = 10000) {
  const ext = path.extname(filePath).toLowerCase().slice(1);
  
  const parser = parsers[ext];
  if (!parser) {
    return { 
      error: `Unsupported file type: .${ext}. Supported types: txt, log, md, json, pdf, docx` 
    };
  }

  try {
    const result = await parser(filePath);
    
    if (result.error) {
      return result;
    }

    const text = result.text || '';
    const truncated = text.length > maxChars;
    const content = truncated ? text.substring(0, maxChars) : text;

    return {
      content,
      truncated,
      totalLength: text.length,
      pages: result.pages || null,
      info: result.info || null
    };
  } catch (err) {
    log.error(`Error parsing ${ext} file:`, err);
    return { error: err.message };
  }
}

export function getSupportedExtensions() {
  return Object.keys(parsers);
}
