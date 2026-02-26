'use client';

import { ConfigProvider, theme } from 'antd';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ConfigProvider
            theme={{
                algorithm: theme.darkAlgorithm,
                token: {
                    colorPrimary: '#00ff41',
                    colorBgBase: '#0a0a0a',
                    colorBgContainer: '#141414',
                    colorBgElevated: '#1a1a1a',
                    colorBorder: '#2a2a2a',
                    colorBorderSecondary: '#222222',
                    colorText: '#e0e0e0',
                    colorTextSecondary: '#888888',
                    colorSuccess: '#00ff41',
                    colorWarning: '#ffb000',
                    colorError: '#ff3333',
                    colorInfo: '#00d4ff',
                    borderRadius: 3,
                    fontFamily: "'Space Grotesk', var(--font-heading), sans-serif",
                    fontFamilyCode: "'IBM Plex Mono', var(--font-mono), monospace",
                },
            }}
        >
            {children}
        </ConfigProvider>
    );
}
