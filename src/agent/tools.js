import { tool } from "@langchain/core/tools";
import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import * as z from "zod";
import { parseFile, getSupportedExtensions } from './file-parser.js';

const readFileTool = tool(
  async ({ file_path }) => {
    const max_chars = 10000;

    try {
      if (!fs.existsSync(file_path)) {
        return { error: `File not found: ${file_path}` };
      }

      const result = await parseFile(file_path, max_chars);
      return result;
    } catch (err) {
      log.error('Read file error:', err);
      return { error: err.message };
    }
  },
  {
    name: 'read_file',
    description: `Read the contents of a file from the local filesystem. Supports: ${getSupportedExtensions().join(', ')}. Use this to read uploaded documents.`,
    schema: z.object({
      file_path: z.string().describe("The path to the file to read"),
    }),
  }
);

const listFilesTool = tool(
  async ({ directory }) => {
    try {
      if (!fs.existsSync(directory)) {
        return { error: `Directory not found: ${directory}` };
      }
      const files = fs.readdirSync(directory);
      const fileInfos = files.map(file => {
        const filePath = path.join(directory, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: filePath,
          isDirectory: stats.isDirectory(),
          size: stats.size,
          modified: stats.mtime.toISOString()
        };
      });
      return { files: fileInfos };
    } catch (err) {
      log.error('List files error:', err);
      return { error: err.message };
    }
  },
  {
    name: 'list_files',
    description: 'List files in a directory.',
    schema: z.object({
      directory: z.string().describe("The directory path to list files from"),
    }),
  }
);

const getFileInfoTool = tool(
  async ({ file_path }) => {
    try {
      if (!fs.existsSync(file_path)) {
        return { error: `File not found: ${file_path}` };
      }
      const stats = fs.statSync(file_path);
      const ext = path.extname(file_path).toLowerCase();
      
      return {
        name: path.basename(file_path),
        path: file_path,
        size: stats.size,
        size_formatted: formatBytes(stats.size),
        extension: ext,
        isDirectory: stats.isDirectory(),
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString()
      };
    } catch (err) {
      log.error('Get file info error:', err);
      return { error: err.message };
    }
  },
  {
    name: 'get_file_info',
    description: 'Get detailed information about a file.',
    schema: z.object({
      file_path: z.string().describe("The path to the file"),
    }),
  }
);

let markdownPreviewCallback = null;

export function setMarkdownPreviewCallback(callback) {
  markdownPreviewCallback = callback;
}

const updateDocumentation = tool(
  async ({ content }) => {
    try {
      if (markdownPreviewCallback) {
        markdownPreviewCallback(content);
      }
      return { success: true, message: "Documentation updated" };
    } catch (err) {
      log.error('update documentation error:', err);
      return { error: err.message };
    }
  },
  {
    name: 'update_documentation',
    description: 'Update the documentation with the generated markdown content. Call this when you have created or modified the documentation you want to show to the user.',
    schema: z.object({
      content: z.string().describe("The complete markdown documentation content"),
    }),
  }
);

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export const tools = [readFileTool, listFilesTool, getFileInfoTool, updateDocumentation];
