import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Sun, ListTodo, AlertTriangle, Inbox, Calendar, Briefcase, Users, BarChart3, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const items = [
  { title: "Today", url: "/", icon: Sun },
  { title: "Tasks", url: "/tasks", icon: ListTodo },
  { title: "Overdue", url: "/overdue", icon: AlertTriangle },
  { title: "Remaining", url: "/remaining", icon: Inbox },
  { title: "Calendar", url: "/calendar", icon: Calendar },
  { title: "Jobs", url: "/jobs", icon: Briefcase },
  { title: "People", url: "/people", icon: Users },
  { title: "Score", url: "/score", icon: BarChart3 },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { signOut, user } = useAuth();

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent>
        <div className="px-4 py-5">
          {collapsed ? (
            <div className="h-8 w-8 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center">
              <span className="font-mono text-xs text-primary">AB</span>
            </div>
          ) : (
            <div className="space-y-0.5">
              <div className="text-sm font-semibold tracking-tight text-sidebar-foreground">Command Center</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Phase 1A</div>
            </div>
          )}
        </div>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Workspace</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <NavLink to={item.url} end={item.url === "/"}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 pb-2 space-y-2">
          {!collapsed && user?.email && (
            <div className="px-2 text-xs text-muted-foreground truncate">{user.email}</div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Sign out</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
