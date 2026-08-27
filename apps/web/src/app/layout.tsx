import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Riwi Co. Messaging',
  description: 'Secure internal messaging platform'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
