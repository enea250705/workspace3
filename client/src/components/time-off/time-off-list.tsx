import { useQuery } from "@tanstack/react-query";
import { format, parseISO, differenceInDays } from "date-fns";
import { it } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";

export function TimeOffList() {
  const { data: timeOffRequests = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/time-off-requests"],
  });
  
  // Filtra le richieste per stato
  const pendingRequests = timeOffRequests.filter(req => req.status === "pending");
  const approvedRequests = timeOffRequests.filter(req => req.status === "approved");
  const rejectedRequests = timeOffRequests.filter(req => req.status === "rejected");
  
  // Funzione per formattare le date
  const formatDateRange = (startDate: string, endDate: string, duration: string) => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const days = differenceInDays(end, start) + 1;
    
    if (startDate === endDate) {
      let durationType = "";
      switch (duration) {
        case "morning":
          durationType = " (mattina)";
          break;
        case "afternoon":
          durationType = " (pomeriggio)";
          break;
        default:
          durationType = " (giornata intera)";
      }
      
      return format(start, "d MMMM yyyy", { locale: it }) + durationType;
    }
    
    return (
      <>
        <span className="block sm:inline">
          {format(start, "d MMMM", { locale: it })} - {format(end, "d MMMM yyyy", { locale: it })}
        </span>
        <span className="text-xs text-gray-500 ml-0 sm:ml-2 block sm:inline">
          {days} {days === 1 ? "giorno" : "giorni"}
        </span>
      </>
    );
  };
  
  // Funzione per ottenere il tipo di richiesta in italiano
  const getTypeLabel = (type: string) => {
    switch (type) {
      case "vacation":
        return "Ferie";
      case "personal":
        return "Permesso personale";
      case "sick":
        return "Malattia";
      default:
        return type;
    }
  };
  
  // Funzione per ottenere l'icona del tipo di richiesta
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "vacation":
        return "beach_access";
      case "personal":
        return "event_available";
      case "sick":
        return "healing";
      default:
        return "event_note";
    }
  };
  
  // Funzione per ottenere il badge di stato
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-600 border-yellow-200">
          <span className="material-icons text-xs mr-1">schedule</span>
          In attesa
        </Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">
          <span className="material-icons text-xs mr-1">check_circle</span>
          Approvata
        </Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">
          <span className="material-icons text-xs mr-1">cancel</span>
          Respinta
        </Badge>;
      default:
        return null;
    }
  };
  
  if (isLoading) {
    return (
      <Card className="bg-white animate-pulse">
        <CardHeader className="pb-3">
          <div className="h-6 w-36 bg-gray-200 rounded mb-3"></div>
        </CardHeader>
        <CardContent>
          <div className="h-10 w-full bg-gray-200 rounded mb-3"></div>
          <div className="h-20 w-full bg-gray-200 rounded mb-3"></div>
          <div className="h-20 w-full bg-gray-200 rounded"></div>
        </CardContent>
      </Card>
    );
  }
  
  if (timeOffRequests.length === 0) {
    return (
      <Card className="bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Le tue richieste</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-6">
            <span className="material-icons text-3xl mb-2">event_busy</span>
            <p>Non hai ancora inviato richieste di ferie o permessi.</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Le tue richieste</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="w-full">
          <div className="w-full mb-4 overflow-x-auto">
            <TabsList className="flex whitespace-nowrap min-w-full w-max">
              <TabsTrigger value="all">
                Tutte <span className="ml-1 text-xs bg-gray-100 px-2 py-0.5 rounded-full">{timeOffRequests.length}</span>
              </TabsTrigger>
              <TabsTrigger value="pending">
                In attesa <span className="ml-1 text-xs bg-yellow-100 px-2 py-0.5 rounded-full">{pendingRequests.length}</span>
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approvate <span className="ml-1 text-xs bg-green-100 px-2 py-0.5 rounded-full">{approvedRequests.length}</span>
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Respinte <span className="ml-1 text-xs bg-red-100 px-2 py-0.5 rounded-full">{rejectedRequests.length}</span>
              </TabsTrigger>
            </TabsList>
          </div>
          
          <div className="overflow-auto max-h-[400px] h-full">
            <TabsContent value="all" className="mt-0">
              <AnimatePresence>
                <motion.div layout className="space-y-3">
                  {timeOffRequests.map(request => (
                    <motion.div
                      key={request.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <RequestCard 
                        request={request}
                        formatDateRange={formatDateRange}
                        getTypeLabel={getTypeLabel}
                        getTypeIcon={getTypeIcon}
                        getStatusBadge={getStatusBadge}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </TabsContent>
            
            <TabsContent value="pending" className="mt-0">
              <AnimatePresence>
                {pendingRequests.length > 0 ? (
                  <motion.div layout className="space-y-3">
                    {pendingRequests.map(request => (
                      <motion.div
                        key={request.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <RequestCard 
                          request={request}
                          formatDateRange={formatDateRange}
                          getTypeLabel={getTypeLabel}
                          getTypeIcon={getTypeIcon}
                          getStatusBadge={getStatusBadge}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  <div className="text-center text-gray-500 py-6">
                    <span className="material-icons mb-1">schedule</span>
                    <p>Non hai richieste in attesa.</p>
                  </div>
                )}
              </AnimatePresence>
            </TabsContent>
            
            <TabsContent value="approved" className="mt-0">
              <AnimatePresence>
                {approvedRequests.length > 0 ? (
                  <motion.div layout className="space-y-3">
                    {approvedRequests.map(request => (
                      <motion.div
                        key={request.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <RequestCard 
                          request={request}
                          formatDateRange={formatDateRange}
                          getTypeLabel={getTypeLabel}
                          getTypeIcon={getTypeIcon}
                          getStatusBadge={getStatusBadge}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  <div className="text-center text-gray-500 py-6">
                    <span className="material-icons mb-1">check_circle</span>
                    <p>Non hai richieste approvate.</p>
                  </div>
                )}
              </AnimatePresence>
            </TabsContent>
            
            <TabsContent value="rejected" className="mt-0">
              <AnimatePresence>
                {rejectedRequests.length > 0 ? (
                  <motion.div layout className="space-y-3">
                    {rejectedRequests.map(request => (
                      <motion.div
                        key={request.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <RequestCard 
                          request={request}
                          formatDateRange={formatDateRange}
                          getTypeLabel={getTypeLabel}
                          getTypeIcon={getTypeIcon}
                          getStatusBadge={getStatusBadge}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  <div className="text-center text-gray-500 py-6">
                    <span className="material-icons mb-1">cancel</span>
                    <p>Non hai richieste respinte.</p>
                  </div>
                )}
              </AnimatePresence>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}

interface RequestCardProps {
  request: any;
  formatDateRange: (startDate: string, endDate: string, duration: string) => JSX.Element | string;
  getTypeLabel: (type: string) => string;
  getTypeIcon: (type: string) => string;
  getStatusBadge: (status: string) => JSX.Element | null;
}

function RequestCard({ request, formatDateRange, getTypeLabel, getTypeIcon, getStatusBadge }: RequestCardProps) {
  const createdAt = parseISO(request.createdAt);
  
  return (
    <div className="p-3 sm:p-4 border rounded-md hover:bg-gray-50 transition-colors">
      <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
        <div className="flex items-center">
          <span className="material-icons mr-2 text-primary">{getTypeIcon(request.type)}</span>
          <div className="font-medium">{getTypeLabel(request.type)}</div>
        </div>
        <div>{getStatusBadge(request.status)}</div>
      </div>
      
      <div className="text-sm text-gray-600 mb-2">
        {formatDateRange(request.startDate, request.endDate, request.duration)}
      </div>
      
      {request.reason && (
        <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
          <div className="font-medium flex items-center">
            <span className="material-icons text-xs mr-1">description</span>
            Motivo:
          </div>
          <div className="pl-4 text-xs sm:text-sm mt-1">{request.reason}</div>
        </div>
      )}
      
      <div className="mt-2 text-xs text-gray-500 flex items-center">
        <span className="material-icons text-xs mr-1">event</span>
        Richiesta inviata il {format(createdAt, "d MMM yyyy", { locale: it })}
      </div>
    </div>
  );
}