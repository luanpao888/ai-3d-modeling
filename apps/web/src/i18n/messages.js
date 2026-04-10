import en from './locales/en.js';
import zhCN from './locales/zh-CN.js';

export const DEFAULT_LOCALE = 'en';

export const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '中文' }
];

export const messages = {
  en,
  'zh-CN': zhCN
};
