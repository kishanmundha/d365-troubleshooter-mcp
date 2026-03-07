import fs from 'fs';
import path from 'path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_FILE_PATH =
  process.env.MCP_LOG_FILE ?? './.d365-troubleshooter-mcp.log';
const LOG_TO_STDERR = process.env.MCP_LOG_STDERR === 'true';

function safeSerialize(value: unknown): string {
  if (value instanceof Error) {
    return [value.name, value.message, value.stack].filter(Boolean).join(' | ');
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatLine(level: LogLevel, message: string, args: unknown[]): string {
  const timestamp = new Date().toISOString();
  const payload =
    args.length > 0 ? ` | ${args.map(safeSerialize).join(' | ')}` : '';
  return `${timestamp} [${level.toUpperCase()}] ${message}${payload}\n`;
}

function writeLog(
  level: LogLevel,
  message: string,
  args: unknown[] = [],
): void {
  const line = formatLine(level, message, args);

  try {
    const directory = path.dirname(LOG_FILE_PATH);
    fs.mkdirSync(directory, { recursive: true });
    fs.appendFileSync(LOG_FILE_PATH, line, 'utf-8');
  } catch {
    if (LOG_TO_STDERR) {
      process.stderr.write(line);
    }
    return;
  }

  if (LOG_TO_STDERR) {
    process.stderr.write(line);
  }
}

export const logger = {
  debug(message: string, ...args: unknown[]) {
    writeLog('debug', message, args);
  },
  info(message: string, ...args: unknown[]) {
    writeLog('info', message, args);
  },
  warn(message: string, ...args: unknown[]) {
    writeLog('warn', message, args);
  },
  error(message: string, ...args: unknown[]) {
    writeLog('error', message, args);
  },
};
