import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/auth-context";

import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Schedule from "@/pages/schedule";
import Users from "@/pages/users";
import Documents from "@/pages/documents";
import Requests from "@/pages/requests";
import TimeOff from "@/pages/time-off";
import MySchedule from "@/pages/my-schedule";
import MyDocuments from "@/pages/my-documents";
import Messages from "@/pages/messages";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/schedule" component={Schedule} />
      <Route path="/users" component={Users} />
      <Route path="/documents" component={Documents} />
      <Route path="/requests" component={Requests} />
      <Route path="/time-off" component={TimeOff} />
      <Route path="/my-schedule" component={MySchedule} />
      <Route path="/my-documents" component={MyDocuments} />
      <Route path="/messages" component={Messages} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider attribute="class" defaultTheme="light">
          <Toaster />
          <Router />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
