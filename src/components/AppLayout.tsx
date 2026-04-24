import { Outlet, Link } from 'react-router-dom';
import { LayoutDashboard, FilePlus } from 'lucide-react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { AppSidebar } from './AppSidebar';
import { FloatingAIWidget } from './FloatingAIWidget';
import { useSwipeBack } from '@/hooks/useSwipeBack';

export function AppLayout() {
  useSwipeBack();
  return (
    <SidebarProvider>
      <div className="flex min-h-[100dvh] w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="safe-area-pt flex min-h-[3.5rem] shrink-0 items-center justify-between border-b bg-card px-3 sm:px-4">
            <div className="flex items-center min-w-0">
              <SidebarTrigger className="hidden sm:inline-flex h-7 w-7" aria-label="Open navigation menu" />
              <span className="ml-0 sm:ml-3 text-sm font-medium text-muted-foreground truncate">TVIK Estimator</span>
            </div>

            <div className="flex items-center gap-1 sm:hidden">
              <Button asChild variant="ghost" size="icon" className="h-10 w-10" aria-label="Go to Dashboard">
                <Link to="/admin-dashboard">
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="sr-only">Dashboard</span>
                </Link>
              </Button>
              <Button asChild variant="ghost" size="icon" className="h-10 w-10" aria-label="Create New Estimate">
                <Link to="/estimates/new">
                  <FilePlus className="h-4 w-4" />
                  <span className="sr-only">New Estimate</span>
                </Link>
              </Button>
              <SidebarTrigger className="h-10 w-10" aria-label="Open navigation menu" />
            </div>
          </header>
          <main className="safe-area-pb flex-1 overflow-auto p-3 sm:p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
      <FloatingAIWidget />
    </SidebarProvider>
  );
}

