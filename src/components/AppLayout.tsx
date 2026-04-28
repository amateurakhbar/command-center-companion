import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";

const titles: Record<string, string> = {
  "/": "Today",
  "/tasks": "Tasks",
  "/overdue": "Overdue",
  "/jobs": "Jobs",
  "/people": "People",
  "/score": "Score",
  "/settings": "Settings",
};

export default function AppLayout() {
  const { pathname } = useLocation();
  const title = titles[pathname] ?? "Command Center";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b border-border bg-surface-1/60 backdrop-blur px-3 sm:px-4 sticky top-0 z-30">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <h1 className="text-sm font-semibold tracking-tight">{title}</h1>
          </header>
          <main className="flex-1 pb-20 md:pb-0">
            <Outlet />
          </main>
        </div>
        <MobileBottomNav />
      </div>
    </SidebarProvider>
  );
}
