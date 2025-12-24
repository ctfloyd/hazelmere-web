import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {/* Add top padding on mobile for fixed header */}
        <div className="p-4 pt-[69px] md:p-8 md:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}