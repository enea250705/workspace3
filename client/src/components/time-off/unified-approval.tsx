import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export function UnifiedTimeOffApproval() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  
  // Carica tutte le richieste in attesa
  const { data: pendingRequests = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/time-off-requests"],
    select: (data) => data.filter((req: any) => req.status === "pending"),
  });
  
  // Carica informazioni utenti per mostrare i nomi
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });
  
  // Funzione per ottenere il nome utente dalla richiesta
  const getUserName = (userId: number) => {
    const user = users.find(u => u.id === userId);
    return user ? user.name : `Utente #${userId}`;
  };
  
  // Funzione per formattare le date
  const formatDateRange = (startDate: string, endDate: string, duration: string) => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    
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
    
    return `${format(start, "d MMMM", { locale: it })} - ${format(end, "d MMMM yyyy", { locale: it })}`;
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
  
  // Mutazione per approvare una richiesta
  const approveRequest = useMutation({
    mutationFn: (requestId: number) => {
      console.log(`Approvazione richiesta ID: ${requestId}`);
      return apiRequest("POST", `/api/time-off-requests/${requestId}/approve`);
    },
    onSuccess: (_, requestId) => {
      // Trova la richiesta nel cache
      const request = pendingRequests.find(req => req.id === requestId);
      
      // Aggiorna le query
      queryClient.invalidateQueries({ queryKey: ["/api/time-off-requests"] });
      
      // Mostra notifica di successo
      toast({
        title: "Richiesta approvata",
        description: `Richiesta di ${getUserName(request?.userId)} approvata con successo.`,
      });
    },
    onError: (error) => {
      console.error("Errore durante l'approvazione:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'approvazione della richiesta",
        variant: "destructive",
      });
    },
  });
  
  // Mutazione per rifiutare una richiesta
  const rejectRequest = useMutation({
    mutationFn: (requestId: number) => {
      console.log(`Rifiuto richiesta ID: ${requestId}`);
      return apiRequest("POST", `/api/time-off-requests/${requestId}/reject`, {
        reason: rejectionReason
      });
    },
    onSuccess: (_, requestId) => {
      // Trova la richiesta nel cache
      const request = pendingRequests.find(req => req.id === requestId);
      
      // Aggiorna le query
      queryClient.invalidateQueries({ queryKey: ["/api/time-off-requests"] });
      
      // Chiudi il dialog e resetta lo stato
      setShowRejectDialog(false);
      setRejectionReason("");
      setSelectedRequest(null);
      
      // Mostra notifica di successo
      toast({
        title: "Richiesta respinta",
        description: `Richiesta di ${getUserName(request?.userId)} respinta.`,
      });
    },
    onError: (error) => {
      console.error("Errore durante il rifiuto:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il rifiuto della richiesta",
        variant: "destructive",
      });
      setShowRejectDialog(false);
    },
  });
  
  // Gestione apertura dialog di rifiuto
  const handleOpenRejectDialog = (request: any) => {
    setSelectedRequest(request);
    setShowRejectDialog(true);
  };
  
  if (isLoading) {
    return (
      <Card className="bg-white animate-pulse">
        <CardHeader>
          <div className="h-6 w-80 bg-gray-200 rounded mb-3"></div>
        </CardHeader>
        <CardContent>
          <div className="h-24 w-full bg-gray-200 rounded mb-3"></div>
          <div className="h-24 w-full bg-gray-200 rounded mb-3"></div>
        </CardContent>
      </Card>
    );
  }
  
  if (pendingRequests.length === 0) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Richieste in Attesa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            <span className="material-icons text-4xl mb-2">check_circle</span>
            <p>Non ci sono richieste in attesa.</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <>
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Richieste in Attesa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {pendingRequests.map(request => (
              <div key={request.id} className="p-4 border rounded-md">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-medium text-lg">{getUserName(request.userId)}</div>
                    <div className="text-sm font-semibold mt-1">
                      {getTypeLabel(request.type)}:&nbsp;
                      <span className="font-normal">{formatDateRange(request.startDate, request.endDate, request.duration)}</span>
                    </div>
                    
                    {request.reason && (
                      <div className="mt-2 text-sm text-gray-600">
                        <div className="font-medium">Motivo:</div>
                        <div>{request.reason}</div>
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-600 border-yellow-200">
                    In attesa
                  </Badge>
                </div>
                
                <div className="mt-4 flex gap-2 justify-end">
                  <Button 
                    variant="outline" 
                    className="border-red-300 text-red-600 hover:bg-red-50"
                    onClick={() => handleOpenRejectDialog(request)}
                    disabled={rejectRequest.isPending || approveRequest.isPending}
                  >
                    <span className="material-icons text-sm mr-1">close</span>
                    Rifiuta
                  </Button>
                  <Button 
                    variant="outline" 
                    className="border-green-300 text-green-600 hover:bg-green-50"
                    onClick={() => approveRequest.mutate(request.id)}
                    disabled={rejectRequest.isPending || approveRequest.isPending}
                  >
                    {approveRequest.isPending && approveRequest.variables === request.id ? (
                      <>
                        <span className="material-icons animate-spin mr-2">sync</span>
                        Approvazione in corso...
                      </>
                    ) : (
                      <>
                        <span className="material-icons text-sm mr-1">check</span>
                        Approva
                      </>
                    )}
                  </Button>
                </div>
                
                <div className="mt-3 text-xs text-gray-500">
                  Richiesta inviata il {format(parseISO(request.createdAt), "d MMMM yyyy, HH:mm", { locale: it })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Dialog di rifiuto */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rifiuta richiesta</DialogTitle>
            <DialogDescription>
              Inserisci un motivo per il rifiuto della richiesta (opzionale)
            </DialogDescription>
          </DialogHeader>
          
          <Textarea
            placeholder="Inserisci il motivo del rifiuto..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="min-h-[100px]"
          />
          
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              className="w-full sm:w-auto"
              disabled={rejectRequest.isPending}
            >
              Annulla
            </Button>
            <Button
              variant="default"
              className="w-full sm:w-auto bg-red-500 hover:bg-red-600"
              onClick={() => selectedRequest && rejectRequest.mutate(selectedRequest.id)}
              disabled={rejectRequest.isPending}
            >
              {rejectRequest.isPending ? (
                <>
                  <span className="material-icons animate-spin mr-2">sync</span>
                  Rifiuto in corso...
                </>
              ) : (
                "Rifiuta richiesta"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}