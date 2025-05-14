import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { downloadPdf, generatePayslipFilename, generateTaxDocFilename } from "@/lib/pdf-utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";

export function DocumentList() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin';
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  
  // Carica documenti
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["/api/documents"],
  });
  
  // Carica informazioni utenti per mostrare i nomi (solo per admin)
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    enabled: isAdmin,
  });
  
  // Filtra documenti in base al ruolo
  const filteredDocuments = isAdmin
    ? documents
    : documents.filter((doc: any) => doc.userId === user?.id);
    
  // Ordina per data di caricamento (più recenti prima)
  const sortedDocuments = [...filteredDocuments].sort((a: any, b: any) => 
    new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
  
  // Mutazione per eliminare un documento (solo per admin)
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Documento eliminato",
        description: "Il documento è stato eliminato con successo",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'eliminazione del documento",
        variant: "destructive",
      });
    },
  });
  
  // Funzione per scaricare un documento
  const handleDownload = (document: any) => {
    const { type, period, fileData, userId } = document;
    const employeeName = isAdmin 
      ? users.find((u: any) => u.id === userId)?.name || `Utente ${userId}`
      : user?.name || "";
      
    let filename = "";
    if (type === "payslip") {
      filename = generatePayslipFilename(period, employeeName);
    } else if (type === "tax_document") {
      filename = generateTaxDocFilename(period, employeeName);
    } else {
      filename = `documento_${period}.pdf`;
    }
    
    downloadPdf(filename, fileData);
  };
  
  // Funzione per eliminare un documento (solo admin)
  const handleDelete = (id: number) => {
    if (confirm("Sei sicuro di voler eliminare questo documento?")) {
      deleteMutation.mutate(id);
    }
  };
  
  // Funzione per ottenere il nome dell'utente (solo per admin)
  const getUserName = (userId: number) => {
    if (!isAdmin) return "";
    const user = users.find((u: any) => u.id === userId);
    return user ? user.name : `Utente ${userId}`;
  };
  
  // Funzione per preview documento
  const handlePreview = (document: any) => {
    setSelectedDocument(document);
    setPreviewOpen(true);
  };
  
  // Formatta il tipo di documento
  const formatDocumentType = (type: string) => {
    switch (type) {
      case "payslip":
        return "Busta paga";
      case "tax_document":
        return "CUD";
      default:
        return type;
    }
  };
  
  if (isLoading) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>I tuoi documenti</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <span className="material-icons animate-spin text-primary">sync</span>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (sortedDocuments.length === 0) {
    return (
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>{isAdmin ? "Documenti" : "I tuoi documenti"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <span className="material-icons text-4xl text-gray-400 mb-2">description</span>
            <p className="text-gray-500">
              {isAdmin 
                ? "Non ci sono documenti caricati nel sistema"
                : "Non ci sono documenti disponibili per te al momento"}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <>
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>{isAdmin ? "Documenti" : "I tuoi documenti"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sortedDocuments.map((doc: any) => (
              <div 
                key={doc.id} 
                className="p-4 border rounded-md"
              >
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 gap-2">
                  <div>
                    <div className="flex items-center">
                      <span className="material-icons text-primary mr-2">
                        {doc.type === "payslip" ? "receipt" : "description"}
                      </span>
                      <span className="font-medium">
                        {formatDocumentType(doc.type)}
                      </span>
                    </div>
                    <div className="mt-1 text-sm">
                      <span className="text-gray-500">Periodo:</span> {doc.period}
                    </div>
                    {isAdmin && (
                      <div className="mt-1 text-sm">
                        <span className="text-gray-500">Dipendente:</span> {getUserName(doc.userId)}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-gray-500">
                      Caricato il {format(parseISO(doc.uploadedAt), "d MMMM yyyy", { locale: it })}
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 self-start sm:self-auto mt-2 sm:mt-0">
                    PDF
                  </Badge>
                </div>
                
                {/* Desktop actions */}
                <div className="hidden sm:flex sm:flex-wrap gap-2 mt-3 sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-blue-600 border-blue-300 hover:bg-blue-50 text-xs"
                    onClick={() => handlePreview(doc)}
                  >
                    <span className="material-icons text-sm mr-1">visibility</span>
                    Anteprima
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-green-600 border-green-300 hover:bg-green-50 text-xs"
                    onClick={() => handleDownload(doc)}
                  >
                    <span className="material-icons text-sm mr-1">download</span>
                    Scarica
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-300 hover:bg-red-50 text-xs"
                      onClick={() => handleDelete(doc.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <span className="material-icons text-sm mr-1">delete</span>
                      Elimina
                    </Button>
                  )}
                </div>

                {/* Mobile actions */}
                <div className="sm:hidden flex items-center justify-center mt-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full">
                        Azioni <MoreVertical className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" className="w-[180px]">
                      <DropdownMenuItem onClick={() => handlePreview(doc)}>
                        <span className="material-icons text-sm mr-2 text-blue-600">visibility</span>
                        Anteprima
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownload(doc)}>
                        <span className="material-icons text-sm mr-2 text-green-600">download</span>
                        Scarica
                      </DropdownMenuItem>
                      {isAdmin && (
                        <DropdownMenuItem 
                          onClick={() => handleDelete(doc.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <span className="material-icons text-sm mr-2 text-red-600">delete</span>
                          Elimina
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl h-[80vh] w-[92%] md:w-full" aria-describedby="pdf-preview">
          <DialogHeader>
            <DialogTitle>
              {selectedDocument && (
                <>
                  {formatDocumentType(selectedDocument.type)} - {selectedDocument.period}
                </>
              )}
            </DialogTitle>
            <DialogDescription id="pdf-preview" className="sr-only">
              Anteprima del documento PDF
            </DialogDescription>
          </DialogHeader>
          
          {selectedDocument && (
            <div className="h-full max-h-[calc(80vh-80px)] overflow-auto">
              <iframe
                src={selectedDocument.fileData.startsWith('data:application/pdf;base64,')
                  ? selectedDocument.fileData
                  : `data:application/pdf;base64,${selectedDocument.fileData}`}
                className="w-full h-full min-h-[500px]"
                title="Anteprima PDF"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}