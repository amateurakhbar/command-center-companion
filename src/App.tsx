import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import AuthPage from "@/pages/Auth";
import Today from "@/pages/Today";
import Tasks from "@/pages/Tasks";
import Overdue from "@/pages/Overdue";
import Remaining from "@/pages/Remaining";
import CalendarPage from "@/pages/Calendar";
import Jobs from "@/pages/Jobs";
import People from "@/pages/People";
import Score from "@/pages/Score";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner position="top-right" richColors theme="dark" />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Today />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/overdue" element={<Overdue />} />
                <Route path="/remaining" element={<Remaining />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/jobs" element={<Jobs />} />
                <Route path="/people" element={<People />} />
                <Route path="/score" element={<Score />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
