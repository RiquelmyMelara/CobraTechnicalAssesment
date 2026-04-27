import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { AuthProvider } from '../lib/auth';
import { Nav } from './Nav';

export const metadata: Metadata = {
  title: 'Pet Adoption Board',
  description: 'Cobra Studio backend assessment — Option E (Pet Adoption).',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Nav />
          <main className="app-shell">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
