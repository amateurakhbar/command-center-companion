import { forwardRef, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Sun,
  ListTodo,
  Inbox,
  Calendar,
  MoreHorizontal,
  AlertTriangle,
  Briefcase,
  Users,
  BarChart3,
  Activity,
  Settings as SettingsIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const primary = [
  { title: "Today", url: "/", icon: Sun },
  { title: "Tasks", url: "/tasks", icon: ListTodo },
  { title: "Remaining", url: "/remaining", icon: Inbox },
  { title: "Calendar", url: "/calendar", icon: Calendar },
];

const more = [
  { title: "Overdue", url: "/overdue", icon: AlertTriangle },
  { title: "Jobs", url: "/jobs", icon: Briefcase },
  { title: "People", url: "/people", icon: Users },
  { title: "Score", url: "/score", icon: BarChart3 },
  { title: "Health", url: "/automation-health", icon: Activity },
  { title: "Settings", url: "/settings", icon: SettingsIcon },
];

export const MobileBottomNav = forwardRef<HTMLElement>((_props, ref) => {
  const [open, setOpen] = useState(false);

  return (
    <nav
      ref={ref}
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-surface-1/95 backdrop-blur supports-[backdrop-filter]:bg-surface-1/80 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-5">
        {primary.map((item) => (
          <li key={item.title}>
            <NavLink
              to={item.url}
              end={item.url === "/"}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium",
                  isActive ? "text-primary" : "text-muted-foreground",
                )
              }
            >
              <item.icon className="h-5 w-5" />
              <span>{item.title}</span>
            </NavLink>
          </li>
        ))}
        <li>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="w-full flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground"
              >
                <MoreHorizontal className="h-5 w-5" />
                <span>More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="pb-[calc(env(safe-area-inset-bottom)+1rem)]">
              <SheetHeader className="text-left">
                <SheetTitle>More</SheetTitle>
              </SheetHeader>
              <ul className="mt-3 grid grid-cols-3 gap-2">
                {more.map((item) => (
                  <li key={item.title}>
                    <NavLink
                      to={item.url}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "flex flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-1 p-3 text-xs",
                          isActive ? "text-primary border-primary/40" : "text-foreground",
                        )
                      }
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
});

MobileBottomNav.displayName = "MobileBottomNav";
