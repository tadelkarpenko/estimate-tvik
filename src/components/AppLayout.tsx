import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { FloatingAIWidget } from './FloatingAIWidget';

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="flex items-center border-b bg-card px-3 sm:px-4 shrink-0 min-h-[3rem]" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
            <SidebarTrigger className="h-10 w-10 sm:h-7 sm:w-7" />
            <span className="ml-2 sm:ml-3 text-sm font-medium text-muted-foreground truncate">TVIK Estimator</span>
          </header>
          <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
      <FloatingAIWidget />
    </SidebarProvider>
  );
}
