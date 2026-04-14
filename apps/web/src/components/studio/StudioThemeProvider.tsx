import { type ReactNode } from 'react';
import { App as AntApp, ConfigProvider, type ThemeConfig } from 'antd';
import { XProvider } from '@ant-design/x';

const THEME_CONFIG: ThemeConfig = {
  token: {
    colorBgBase: '#ffffff',
    colorText: '#171717',
    colorTextSecondary: '#666666',
    colorPrimary: '#0a72ef',
    colorBorder: 'rgba(0,0,0,0.08)',
    colorSplit: '#ebebeb',
    borderRadius: 8,
    fontFamily: "Geist, 'Helvetica Neue', Arial, sans-serif",
    boxShadow:
      'rgba(0,0,0,0.08) 0 0 0 1px, rgba(0,0,0,0.04) 0 2px 2px, rgba(0,0,0,0.04) 0 8px 8px -8px, #fafafa 0 0 0 1px'
  },
  components: {
    Layout: {
      siderBg: 'rgba(255,255,255,0.92)',
      headerBg: '#ffffff',
      bodyBg: '#ffffff',
      triggerBg: '#ffffff'
    },
    Card: { bodyPadding: 16, headerBg: '#ffffff' },
    Button: {
      borderRadius: 6,
      controlHeight: 38,
      defaultShadow: 'rgb(235,235,235) 0 0 0 1px',
      primaryShadow: 'rgb(23,23,23) 0 0 0 1px'
    },
    Modal: { contentBg: '#ffffff', headerBg: '#ffffff' }
  }
};

export function StudioThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider theme={THEME_CONFIG}>
      <AntApp>
        <XProvider>{children}</XProvider>
      </AntApp>
    </ConfigProvider>
  );
}