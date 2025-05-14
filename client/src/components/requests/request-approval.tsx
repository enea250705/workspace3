import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

export function RequestApproval() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const requestsPerPage = 5;
  
  // Fetch pending time off requests
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["/api/time-off-requests"],
  });
  
  // Fetch all users for displaying names
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
  });
  
  // Approve request mutation
  const approveMutation = useMutation({
    mutationFn: (requestId: number) =>
      apiRequest("POST", `/api/time-off-requests/${requestId}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-off-requests"] });
      toast({
        title: "Richiesta approvata",
        description: "La richiesta è stata approvata con successo.",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'approvazione della richiesta.",
        variant: "destructive",
      });
    }
  });
  
  // Reject request mutation
  const rejectMutation = useMutation({
    mutationFn: (requestId: number) =>
      apiRequest("POST", `/api/time-off-requests/${requestId}/reject`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-off-requests"] });
      toast({
        title: "Richiesta rifiutata",
        description: "La richiesta è stata rifiutata.",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il rifiuto della richiesta.",
        variant: "destructive",
      });
    }
  });
  
  // Filter pending requests
  const pendingRequests = requests.filter((req: any) => req.status === "pending");
  
  // Get username from userId
  const getUserName = (userId: number) => {
    const user = users.find((u: any) => u.id === userId);
    return user ? user.name : "Utente sconosciuto";
  };
  
  // Format request type
  const formatRequestType = (type: string) => {
    switch (type) {
      case "vacation":
        return "Richiesta Ferie";
      case "personal":
        return "Permesso Personale";
      case "sick":
        return "Malattia";
      default:
        return "Richiesta";
    }
  };
  
  // Paginate requests
  const totalPages = Math.ceil(pendingRequests.length / requestsPerPage);
  const paginatedRequests = pendingRequests.slice(
    (currentPage - 1) * requestsPerPage,
    currentPage * requestsPerPage
  );
  
  // Process request
  const processRequest = (requestId: number, approve: boolean) => {
    if (approve) {
      console.log(`Approvazione richiesta ID: ${requestId}`);
      approveMutation.mutate(requestId);
    } else {
      console.log(`Rifiuto richiesta ID: ${requestId}`);
      rejectMutation.mutate(requestId);
    }
  };
  
  // Format duration
  const formatDuration = (duration: string) => {
    switch (duration) {
      case "full_day":
        return "Giornata intera";
      case "morning":
        return "Mattina";
      case "afternoon":
        return "Pomeriggio";
      case "multi_day":
        return "Più giorni";
      default:
        return duration;
    }
  };
  
  return (
    <Card className="shadow-sm">
      <CardHeader className="px-4 py-3 border-b">
        <CardTitle className="text-base font-medium">Richieste in Attesa</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {isLoading ? (
          <div className="py-8 text-center">
            <span className="material-icons animate-spin text-primary">sync</span>
            <p className="mt-2 text-sm text-gray-500">Caricamento richieste...</p>
          </div>
        ) : pendingRequests.length === 0 ? (
          <div className="py-8 text-center">
            <span className="material-icons text-4xl text-gray-400">check_circle</span>
            <p className="mt-2 text-gray-500">Nessuna richiesta in attesa di approvazione</p>
          </div>
        ) : (
          <div className="space-y-4">
            {paginatedRequests.map((request: any) => (
              <div 
                key={request.id}
                className="border rounded-md p-4"
              >
                <div className="sm:flex justify-between">
                  <div>
                    <div className="flex items-center mb-2">
                      <span className="material-icons text-warning mr-2">pending_actions</span>
                      <p className="text-base font-medium">{formatRequestType(request.type)}</p>
                    </div>
                    
                    <div className="space-y-1 text-sm">
                      <p>
                        <span className="font-medium">Da:</span> {getUserName(request.userId)}
                      </p>
                      <p>
                        <span className="font-medium">Periodo:</span> {formatDate(request.startDate)} 
                        {request.startDate !== request.endDate && ` - ${formatDate(request.endDate)}`}
                      </p>
                      <p>
                        <span className="font-medium">Durata:</span> {formatDuration(request.duration)}
                      </p>
                      {request.reason && (
                        <p>
                          <span className="font-medium">Motivo:</span> {request.reason}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        Richiesto il {formatDate(request.createdAt)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center sm:flex-col sm:justify-center space-x-2 sm:space-x-0 sm:space-y-2 mt-4 sm:mt-0">
                    <Button
                      onClick={() => processRequest(request.id, true)}
                      className="bg-success hover:bg-success/90 flex-1 sm:flex-none w-full sm:w-auto"
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                    >
                      <span className="material-icons text-sm mr-1">check</span>
                      Approva
                    </Button>
                    <Button
                      onClick={() => processRequest(request.id, false)}
                      variant="destructive"
                      className="flex-1 sm:flex-none w-full sm:w-auto"
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                    >
                      <span className="material-icons text-sm mr-1">close</span>
                      Rifiuta
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-4">
                <div className="flex space-x-1">
                  <Button
                    variant={currentPage === 1 ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    Precedente
                  </Button>
                  
                  {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                    let pageNumber;
                    
                    if (totalPages <= 3) {
                      pageNumber = i + 1;
                    } else if (currentPage <= 2) {
                      pageNumber = i + 1;
                    } else if (currentPage >= totalPages - 1) {
                      pageNumber = totalPages - 2 + i;
                    } else {
                      pageNumber = currentPage - 1 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNumber}
                        variant={currentPage === pageNumber ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNumber)}
                      >
                        {pageNumber}
                      </Button>
                    );
                  })}
                  
                  <Button
                    variant={currentPage === totalPages ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Successivo
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CompletedRequests() {
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["/api/time-off-requests"],
  });
  
  // Fetch all users for displaying names
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
  });
  
  // Filter completed requests (approved or rejected)
  const completedRequests = requests
    .filter((req: any) => req.status === "approved" || req.status === "rejected")
    .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5); // Show only the 5 most recent
  
  // Get username from userId
  const getUserName = (userId: number) => {
    const user = users.find((u: any) => u.id === userId);
    return user ? user.name : "Utente sconosciuto";
  };
  
  // Format request type
  const formatRequestType = (type: string) => {
    switch (type) {
      case "vacation":
        return "Ferie";
      case "personal":
        return "Permesso Personale";
      case "sick":
        return "Malattia";
      default:
        return type;
    }
  };
  
  // Format request status
  const formatStatus = (status: string) => {
    switch (status) {
      case "approved":
        return { label: "Approvata", color: "bg-green-100 text-green-800", icon: "check_circle" };
      case "rejected":
        return { label: "Rifiutata", color: "bg-red-100 text-red-800", icon: "cancel" };
      default:
        return { label: status, color: "bg-gray-100 text-gray-800", icon: "info" };
    }
  };
  
  return (
    <Card className="shadow-sm mt-6">
      <CardHeader className="px-4 py-3 border-b">
        <CardTitle className="text-base font-medium">Richieste Recenti Processate</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {isLoading ? (
          <div className="py-8 text-center">
            <span className="material-icons animate-spin text-primary">sync</span>
            <p className="mt-2 text-sm text-gray-500">Caricamento richieste...</p>
          </div>
        ) : completedRequests.length === 0 ? (
          <div className="py-8 text-center">
            <span className="material-icons text-4xl text-gray-400">history</span>
            <p className="mt-2 text-gray-500">Nessuna richiesta processata di recente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {completedRequests.map((request: any) => {
              const status = formatStatus(request.status);
              
              return (
                <div 
                  key={request.id}
                  className="border rounded-md p-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center mb-1">
                        <span className={`material-icons text-sm mr-2 ${
                          request.status === "approved" ? "text-success" : "text-error"
                        }`}>
                          {status.icon}
                        </span>
                        <p className="text-sm font-medium">
                          {formatRequestType(request.type)} - {getUserName(request.userId)}
                        </p>
                        <span className={`ml-3 px-2 py-0.5 rounded-full text-xs ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      
                      <div className="ml-6">
                        <p className="text-xs text-gray-600">
                          Periodo: {formatDate(request.startDate)} 
                          {request.startDate !== request.endDate && ` - ${formatDate(request.endDate)}`}
                        </p>
                        <p className="text-xs text-gray-500">
                          {request.status === "approved" ? "Approvato" : "Rifiutato"} il {formatDate(request.updatedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
