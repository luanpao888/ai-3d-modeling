import en from './locales/en.js';
import zhCN from './locales/zh-CN.js';

export const DEFAULT_LOCALE = 'en';

export const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '中文' }
] as const;

export const messages: Record<string, Record<string, unknown>> = {
  en,
  'zh-CN': zhCN
};