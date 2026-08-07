import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LiveStream Hub',
  description: 'Self-hosted 24/7 YouTube Live & RTMP streaming manager',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0a0a0f" />
      </head>
      <body>{children}</body>
    </html>
  );
}
