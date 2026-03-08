import { LayoutDashboard, FilePlus, FileText, BookOpen, ShieldAlert, Search, Settings, LogOut, Briefcase, HardHat, CalendarDays, ClipboardList } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupContent,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

const navItems = [
  { title: 'Dashboard', url: '/admin-dashboard', icon: LayoutDashboard },
  { title: 'New Estimate', url: '/estimates/new', icon: FilePlus },
  { title: 'Estimates', url: '/estimates', icon: FileText },
  { title: 'Cost Library', url: '/cost-library', icon: BookOpen },
  { title: 'Risk Library', url: '/risk-library', icon: ShieldAlert },
  { title: 'Cost Audit', url: '/cost-audit', icon: Search },
  { title: 'Review Queue', url: '/review-queue', icon: ClipboardList },
  { title: 'Contracts', url: '/contracts', icon: Briefcase },
  { title: 'Jobs', url: '/jobs', icon: HardHat },
  { title: 'Job Calendar', url: '/jobs/calendar', icon: CalendarDays },
  { title: 'Admin', url: '/admin', icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { signOut, user } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {!collapsed && (
          <div className="px-4 py-5">
            <h1 className="text-lg font-bold text-sidebar-primary">TVIK LLC</h1>
            <p className="text-xs text-sidebar-foreground/60">Estimator</p>
          </div>
        )}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(item => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/estimates'}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {!collapsed && user && (
          <p className="px-3 pb-1 text-xs text-sidebar-foreground/50 truncate">{user.email}</p>
        )}
        <Button variant="ghost" className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && 'Sign Out'}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
