import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, FilePlus, ChevronLeft, FileText, ClipboardList, Smartphone } from 'lucide-react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { AppSidebar } from './AppSidebar';
import { FloatingAIWidget } from './FloatingAIWidget';
import { useSwipeBack } from '@/hooks/useSwipeBack';

export function AppLayout() {
  useSwipeBack();
  const navigate = useNavigate();
  const location = useLocation();

  // Hide Back on top-level pages where there's nothing meaningful to go back to.
  const TOP_LEVEL = new Set([
    '/admin-dashboard', '/estimates', '/contracts', '/jobs',
    '/jobs/calendar', '/cost-library', '/risk-library', '/cost-audit',
    '/review-queue', '/admin', '/field',
  ]);
  const showBack = !TOP_LEVEL.has(location.pathname);
  const showMobileBottomNav = !location.pathname.startsWith('/field');
  const bottomNavItems = [
    { title: 'Home', url: '/admin-dashboard', icon: LayoutDashboard, active: location.pathname === '/admin-dashboard' },
    { title: 'Estimates', url: '/estimates', icon: FileText, active: location.pathname.startsWith('/estimates') },
    { title: 'Review', url: '/review-queue', icon: ClipboardList, active: location.pathname === '/review-queue' },
    { title: 'Field', url: '/field', icon: Smartphone, active: location.pathname.startsWith('/field') },
  ];

  const handleBack = () => {
    // Prefer real history; fall back to a sensible parent route.
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    if (location.pathname.startsWith('/estimates/')) navigate('/estimates');
    else if (location.pathname.startsWith('/contracts/')) navigate('/contracts');
    else if (location.pathname.startsWith('/jobs/')) navigate('/jobs');
    else navigate('/admin-dashboard');
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-[100dvh] w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="safe-area-pt flex min-h-[3.5rem] shrink-0 items-center justify-between border-b bg-card px-3 sm:px-4">
            <div className="flex items-center min-w-0 gap-1">
              {showBack && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 -ml-2"
                  onClick={handleBack}
                  aria-label="Go back"
                >
                  <ChevronLeft className="h-5 w-5" />
                  <span className="sr-only">Back</span>
                </Button>
              )}
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
          <main className={`safe-area-pb flex-1 overflow-auto p-3 sm:p-4 md:p-6 ${showMobileBottomNav ? 'pb-24 sm:pb-4 md:pb-6' : ''}`}>
            <Outlet />
          </main>
        </div>
      </div>
      {showMobileBottomNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 px-2 py-2 shadow-lg backdrop-blur sm:hidden safe-area-pb" aria-label="Mobile app navigation">
          <div className="grid grid-cols-4 gap-1">
            {bottomNavItems.map(item => (
              <Button
                key={item.url}
                asChild
                variant={item.active ? 'secondary' : 'ghost'}
                className="h-14 flex-col gap-1 rounded-md px-1 text-xs"
              >
                <Link to={item.url} aria-current={item.active ? 'page' : undefined}>
                  <item.icon className="h-4 w-4" />
                  <span className="leading-none">{item.title}</span>
                </Link>
              </Button>
            ))}
          </div>
        </nav>
      )}
      <FloatingAIWidget />
    </SidebarProvider>
  );
}

