import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout/layout";
import { CompletedRequests } from "@/components/requests/request-approval";
import { UnifiedTimeOffApproval } from "@/components/time-off/unified-approval";

export default function Requests() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login");
    }
    
    if (!isLoading && isAuthenticated && user?.role !== "admin") {
      navigate("/time-off");
    }
  }, [isLoading, isAuthenticated, navigate, user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <span className="material-icons text-primary animate-spin text-4xl">sync</span>
          <p className="mt-4 text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <UnifiedTimeOffApproval />
        <CompletedRequests />
      </div>
    </Layout>
  );
}
