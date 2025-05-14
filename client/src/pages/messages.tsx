import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout/layout";
import { MessageList } from "@/components/messages/message-list";

export default function Messages() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, isLoading, navigate]);
  
  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <span className="material-icons text-primary animate-spin text-4xl">sync</span>
            <p className="mt-4 text-gray-600">Caricamento...</p>
          </div>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <MessageList />
    </Layout>
  );
}