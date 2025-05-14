import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/layout";
import { DocumentList } from "@/components/documents/document-list";
import { DocumentUpload } from "@/components/documents/document-upload";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AnimatedContainer } from "@/components/ui/animated-container";

export default function Documents() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const isAdmin = user?.role === "admin";
  
  // Fetch users (for admin to select during upload)
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    enabled: isAdmin,
  });
  
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isLoading, isAuthenticated, navigate]);
  
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
      <AnimatedContainer>
        <div className="py-6">
          <div className="mx-auto px-2 sm:px-4 lg:px-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">Documenti</h1>
              <p className="mt-1 text-sm text-gray-500">
                {isAdmin 
                  ? "Gestisci e distribuisci i documenti per i dipendenti"
                  : "Visualizza e scarica i tuoi documenti"}
              </p>
            </div>
            
            {isAdmin ? (
              <Tabs defaultValue="list" className="w-full">
                <TabsList className="w-full mb-6 overflow-x-auto flex-wrap justify-start sm:flex-nowrap sm:justify-center">
                  <TabsTrigger value="list" className="flex-1 min-w-[120px]">Lista documenti</TabsTrigger>
                  <TabsTrigger value="upload" className="flex-1 min-w-[120px]">Carica nuovo</TabsTrigger>
                </TabsList>
                
                <TabsContent value="list" className="space-y-6 overflow-x-auto">
                  <DocumentList />
                </TabsContent>
                
                <TabsContent value="upload" className="space-y-6 overflow-x-auto">
                  <DocumentUpload users={users} />
                </TabsContent>
              </Tabs>
            ) : (
              <DocumentList />
            )}
          </div>
        </div>
      </AnimatedContainer>
    </Layout>
  );
}