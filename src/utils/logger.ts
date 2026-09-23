import config from '../config/config';

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const currentLevel = LOG_LEVELS[config.logLevel as keyof typeof LOG_LEVELS] ?? LOG_LEVELS.INFO;

const formatMessage = (level: string, message: string, data: unknown) => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}]`;

  if (data) {
    return `${prefix} ${message} ${JSON.stringify(data, null, 2)}`;
  }

  return `${prefix} ${message}`;
};

export const logger = {
  error: (message: string, data: unknown = null) => {
    if (currentLevel >= LOG_LEVELS.ERROR) {
      console.error(formatMessage('ERROR', message, data));
    }
  },

  warn: (message: string, data: unknown = null) => {
    if (currentLevel >= LOG_LEVELS.WARN) {
      console.warn(formatMessage('WARN', message, data));
    }
  },

  info: (message: string, data: unknown = null) => {
    if (currentLevel >= LOG_LEVELS.INFO) {
      console.log(formatMessage('INFO', message, data));
    }
  },

  debug: (message: string, data: unknown = null) => {
    if (currentLevel >= LOG_LEVELS.DEBUG) {
      console.log(formatMessage('DEBUG', message, data));
    }
  },

  request: (method: string, url: string, params: unknown = null) => {
    if (currentLevel >= LOG_LEVELS.INFO) {
      console.log(formatMessage('INFO', `${method} ${url}`, params));
    }
  },

  response: (status: number, url: string, duration: number | null = null) => {
    if (currentLevel >= LOG_LEVELS.INFO) {
      const msg = duration
        ? `Response ${status} for ${url} (${duration}ms)`
        : `Response ${status} for ${url}`;
      console.log(formatMessage('INFO', msg, null));
    }
  },
};

export default logger;
