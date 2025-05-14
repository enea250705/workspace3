import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout/layout";
import { TimeOffRequestForm } from "@/components/time-off/time-off-form";
import { TimeOffList } from "@/components/time-off/time-off-list";
import { UnifiedTimeOffApproval } from "@/components/time-off/unified-approval";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export default function TimeOff() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const [, navigate] = useLocation();
  const isAdmin = user?.role === "admin";
  const [activeTab, setActiveTab] = useState<"form" | "list">("form");

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
      <div className="py-4 sm:py-6">
        <div className="mx-auto px-3 sm:px-6 lg:px-8 max-w-6xl">
          <div className="mb-4 sm:mb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Gestione ferie e permessi</h1>
            <p className="mt-1 text-sm text-gray-500">
              Richiedi, visualizza e gestisci le tue assenze dal lavoro.
            </p>
          </div>

          {isAdmin ? (
            <Tabs defaultValue="approve" className="w-full">
              <TabsList className="w-full mb-6 flex flex-wrap">
                <TabsTrigger value="approve" className="flex-1">Richieste</TabsTrigger>
                <TabsTrigger value="request" className="flex-1">Nuova richiesta</TabsTrigger>
                <TabsTrigger value="history" className="flex-1">Cronologia personale</TabsTrigger>
              </TabsList>

              <TabsContent value="approve" className="space-y-6">
                <UnifiedTimeOffApproval />
              </TabsContent>

              <TabsContent value="request" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <TimeOffRequestForm />
                  <Card className="bg-white">
                    <CardHeader>
                      <CardTitle>Istruzioni</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc list-inside space-y-2 text-sm text-gray-600">
                        <li>Seleziona il tipo di assenza che vuoi richiedere (ferie, permesso, malattia)</li>
                        <li>Indica la data di inizio e fine del periodo di assenza</li>
                        <li>Specifica se si tratta di una giornata intera o solo mezza giornata</li>
                        <li>Aggiungi una motivazione se necessario</li>
                        <li>Invia la richiesta e attendi l'approvazione</li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="history" className="space-y-6">
                <TimeOffList />
              </TabsContent>
            </Tabs>
          ) : (
            <>
              {/* Layout per dispositivi mobili: visualizza un componente alla volta con navigazione */}
              <div className="md:hidden mb-4">
                <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg">
                  <Button 
                    variant={activeTab === "form" ? "default" : "outline"}
                    onClick={() => setActiveTab("form")} 
                    className="flex-1 rounded-r-none"
                  >
                    <span className="material-icons mr-1 text-sm">add_circle</span>
                    Nuova richiesta
                  </Button>
                  <Button 
                    variant={activeTab === "list" ? "default" : "outline"}
                    onClick={() => setActiveTab("list")}
                    className="flex-1 rounded-l-none"
                  >
                    <span className="material-icons mr-1 text-sm">history</span>
                    Le tue richieste
                  </Button>
                </div>

                <AnimatePresence mode="wait">
                  {activeTab === "form" && (
                    <motion.div
                      key="form"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                      className="mt-4"
                    >
                      <TimeOffRequestForm />
                    </motion.div>
                  )}

                  {activeTab === "list" && (
                    <motion.div
                      key="list"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="mt-4"
                    >
                      <TimeOffList />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Layout per desktop: visualizza entrambi i componenti affiancati */}
              <div className="hidden md:grid md:grid-cols-2 gap-6">
                <TimeOffRequestForm />
                <TimeOffList />
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
