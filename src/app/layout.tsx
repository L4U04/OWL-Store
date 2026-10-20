// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Owl Store • PS4 Package Manager',
  description: 'Orbis OS FPKG Hub & Remote Package Installer',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="bg-[#070709] text-[#fafafa] antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}