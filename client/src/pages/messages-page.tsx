import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout/layout";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  MailOpen, MailPlus, Trash2, MessageSquare, Send, Inbox, 
  ArrowLeft, CheckCircle, AlertCircle, RotateCcw 
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

// Schema per la creazione di un messaggio
const messageFormSchema = z.object({
  toUserId: z.coerce.number({
    required_error: "Seleziona un destinatario"
  }),
  subject: z.string().min(1, "L'oggetto è obbligatorio"),
  content: z.string().min(1, "Il contenuto del messaggio è obbligatorio"),
  relatedToShiftId: z.coerce.number().optional()
});

type MessageFormValues = z.infer<typeof messageFormSchema>;

// Interfaccia per un messaggio
interface Message {
  id: number;
  fromUserId: number;
  toUserId: number;
  subject: string;
  content: string;
  isRead: boolean;
  relatedToShiftId: number | null;
  createdAt: Date | string;
}

// Interfaccia per un utente
interface User {
  id: number;
  username: string;
  name: string;
  role: string;
}

export default function MessagesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [location, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"received" | "sent">("received");
  const [composeMode, setComposeMode] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  
  // Reindirizza se non autenticato
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, authLoading, navigate]);
  
  // Recupera i messaggi ricevuti
  const { 
    data: receivedMessages = [], 
    isLoading: isLoadingReceived,
    refetch: refetchReceived
  } = useQuery<Message[]>({
    queryKey: ["/api/messages/received"],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(queryKey[0] as string);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Error fetching received messages");
      }
      return res.json();
    },
    enabled: isAuthenticated && activeTab === "received"
  });
  
  // Recupera i messaggi inviati
  const { 
    data: sentMessages = [], 
    isLoading: isLoadingSent,
    refetch: refetchSent
  } = useQuery<Message[]>({
    queryKey: ["/api/messages/sent"],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(queryKey[0] as string);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Error fetching sent messages");
      }
      return res.json();
    },
    enabled: isAuthenticated && activeTab === "sent"
  });
  
  // Recupera gli utenti per la selezione del destinatario
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(queryKey[0] as string);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Error fetching users");
      }
      return res.json();
    },
    enabled: isAuthenticated && composeMode
  });
  
  // Mutation per l'invio di un messaggio
  const sendMessageMutation = useMutation({
    mutationFn: async (data: MessageFormValues) => {
      return apiRequest("/api/messages", "POST", data);
    },
    onSuccess: () => {
      toast({
        title: "Messaggio inviato",
        description: "Il tuo messaggio è stato inviato con successo."
      });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/sent"] });
      setComposeMode(false);
    },
    onError: (error) => {
      console.error("Failed to send message:", error);
      toast({
        title: "Errore",
        description: "Impossibile inviare il messaggio. Riprova più tardi.",
        variant: "destructive"
      });
    }
  });
  
  // Mutation per marcare un messaggio come letto
  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: number) => {
      return apiRequest(`/api/messages/${messageId}/mark-read`, "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/received"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
    onError: (error) => {
      console.error("Failed to mark message as read:", error);
      toast({
        title: "Errore",
        description: "Impossibile segnare il messaggio come letto.",
        variant: "destructive"
      });
    }
  });
  
  // Mutation per l'eliminazione di un messaggio
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: number) => {
      return apiRequest(`/api/messages/${messageId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/received"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/sent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      setSelectedMessage(null);
      toast({
        title: "Successo",
        description: "Messaggio eliminato con successo.",
      });
    },
    onError: (error) => {
      console.error("Failed to delete message:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il messaggio.",
        variant: "destructive"
      });
    }
  });
  
  // Riferimento ai messaggi attivi in base alla tab
  const messages = activeTab === "received" ? receivedMessages : sentMessages;
  const isLoading = activeTab === "received" ? isLoadingReceived : isLoadingSent;
  
  // Formatta la data per la visualizzazione
  const formatMessageDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return format(date, "dd/MM/yyyy HH:mm", { locale: it });
  };
  
  // Visualizza i dettagli di un messaggio
  const handleViewMessage = async (message: Message) => {
    setSelectedMessage(message);
    
    // Se il messaggio non è letto e l'utente è il destinatario, marcalo come letto
    if (!message.isRead && activeTab === "received") {
      await markAsReadMutation.mutateAsync(message.id);
    }
  };
  
  // Gestisce l'eliminazione del messaggio
  const handleDeleteMessage = (messageId: number) => {
    if (confirm("Sei sicuro di voler eliminare questo messaggio?")) {
      deleteMessageMutation.mutate(messageId);
    }
  };
  
  // Gestisce il cambio di tab
  const handleTabChange = (value: string) => {
    setActiveTab(value as "received" | "sent");
    setSelectedMessage(null);
  };
  
  // Aggiorna i messaggi
  const handleRefresh = () => {
    if (activeTab === "received") {
      refetchReceived();
    } else {
      refetchSent();
    }
  };
  
  // Componente per la composizione di un nuovo messaggio
  const MessageComposerForm = () => {
    const form = useForm<MessageFormValues>({
      resolver: zodResolver(messageFormSchema),
      defaultValues: {
        toUserId: undefined,
        subject: "",
        content: "",
        relatedToShiftId: undefined
      }
    });
    
    const onSubmit = (values: MessageFormValues) => {
      sendMessageMutation.mutate(values);
    };
    
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setComposeMode(false)}
              className="mr-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle>Nuovo messaggio</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="toUserId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destinatario</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona un destinatario" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {user.name} ({user.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Oggetto</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Oggetto del messaggio" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contenuto</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Scrivi il tuo messaggio qui..."
                        rows={8}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="relatedToShiftId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Collegato al turno (opzionale)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        value={field.value || ""}
                        placeholder="ID del turno correlato"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-between pt-4">
                <Button variant="outline" type="button" onClick={() => setComposeMode(false)}>
                  Annulla
                </Button>
                <Button 
                  type="submit" 
                  disabled={sendMessageMutation.isPending}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Invia messaggio
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    );
  };
  
  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Spinner size="lg" />
            <p className="mt-4 text-gray-600">Caricamento...</p>
          </div>
        </div>
      </Layout>
    );
  }
  
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Messaggi</h1>
          <div className="flex space-x-2">
            <Button 
              onClick={() => {
                setComposeMode(true);
                setSelectedMessage(null);
              }}
              variant="outline"
            >
              <MailPlus className="mr-2 h-4 w-4" />
              Nuovo messaggio
            </Button>
            <Button 
              onClick={handleRefresh} 
              variant="outline" 
              size="icon"
              title="Aggiorna"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {composeMode ? (
          <MessageComposerForm />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <Tabs value={activeTab} onValueChange={handleTabChange}>
                <TabsList className="w-full">
                  <TabsTrigger value="received" className="flex-1">
                    <Inbox className="mr-2 h-4 w-4" />
                    Ricevuti
                  </TabsTrigger>
                  <TabsTrigger value="sent" className="flex-1">
                    <Send className="mr-2 h-4 w-4" />
                    Inviati
                  </TabsTrigger>
                </TabsList>
                
                <div className="mt-4">
                  {isLoading ? (
                    <div className="flex justify-center p-6">
                      <Spinner />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center p-6 text-muted-foreground">
                      <MessageSquare className="mx-auto h-12 w-12 opacity-20" />
                      <p className="mt-2">Nessun messaggio {activeTab === "received" ? "ricevuto" : "inviato"}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`p-3 rounded-md cursor-pointer border transition-colors ${
                            selectedMessage?.id === message.id
                              ? "bg-muted border-primary"
                              : "hover:bg-muted"
                          } ${
                            !message.isRead && activeTab === "received"
                              ? "border-blue-400 bg-blue-50 dark:bg-blue-950 dark:border-blue-800"
                              : "border-gray-200 dark:border-gray-800"
                          }`}
                          onClick={() => handleViewMessage(message)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="font-medium truncate">
                              {activeTab === "received" ? "Da: " : "A: "}
                              {message.subject}
                            </div>
                            <div className="flex items-center">
                              {!message.isRead && activeTab === "received" && (
                                <Badge variant="default" className="ml-2">Nuovo</Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {formatMessageDate(message.createdAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Tabs>
            </div>
            
            <div className="md:col-span-2">
              {selectedMessage ? (
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{selectedMessage.subject}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {activeTab === "received" ? "Da" : "A"}: {selectedMessage.fromUserId} • {formatMessageDate(selectedMessage.createdAt)}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        {activeTab === "received" && !selectedMessage.isRead && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markAsReadMutation.mutate(selectedMessage.id)}
                          >
                            <MailOpen className="h-4 w-4 mr-2" />
                            Segna come letto
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteMessage(selectedMessage.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Elimina
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="prose dark:prose-invert prose-sm max-w-none">
                      {selectedMessage.content.split('\n').map((line, index) => (
                        <p key={index}>{line}</p>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between border-t pt-4">
                    <div>
                      {selectedMessage.relatedToShiftId && (
                        <Badge variant="outline">
                          Relativo al turno #{selectedMessage.relatedToShiftId}
                        </Badge>
                      )}
                    </div>
                    <div>
                      {activeTab === "received" && (
                        <Button
                          onClick={() => {
                            setComposeMode(true);
                            // TODO: Impostare il destinatario predefinito del messaggio selezionato
                          }}
                        >
                          <MailPlus className="mr-2 h-4 w-4" />
                          Rispondi
                        </Button>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center justify-center min-h-[300px] text-center space-y-4 text-muted-foreground">
                      <MessageSquare className="h-12 w-12 opacity-20" />
                      <div>
                        <p className="font-medium">Nessun messaggio selezionato</p>
                        <p className="text-sm mt-1">
                          Seleziona un messaggio dalla lista per visualizzarlo, o crea un nuovo messaggio.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}