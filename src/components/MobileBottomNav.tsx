import { NavLink } from "react-router-dom";
import { Sun, ListTodo, AlertTriangle, Briefcase, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { title: "Today", url: "/", icon: Sun },
  { title: "Tasks", url: "/tasks", icon: ListTodo },
  { title: "Overdue", url: "/overdue", icon: AlertTriangle },
  { title: "Jobs", url: "/jobs", icon: Briefcase },
  { title: "People", url: "/people", icon: Users },
];

export function MobileBottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-surface-1/95 backdrop-blur supports-[backdrop-filter]:bg-surface-1/80 pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5">
        {items.map((item) => (
          <li key={item.title}>
            <NavLink
              to={item.url}
              end={item.url === "/"}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium",
                  isActive ? "text-primary" : "text-muted-foreground"
                )
              }
            >
              <item.icon className="h-5 w-5" />
              <span>{item.title}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
