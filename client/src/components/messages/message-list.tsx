import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  MailOpen, MailPlus, Trash2, MessageSquare, Send, Inbox, 
  CheckCircle, AlertCircle, RotateCcw
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { MessageComposer } from "./message-composer";
import { Message } from "@shared/schema";

export function MessageList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"received" | "sent">("received");
  const [composeMode, setComposeMode] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  
  // Fetch messages (received and sent)
  const { 
    data: receivedMessages = [] as Message[],
    isLoading: isLoadingReceived,
    refetch: refetchReceived
  } = useQuery<Message[]>({
    queryKey: ["/api/messages/received"],
    queryFn: getQueryFn<Message[]>({ on401: "throw" }),
    enabled: activeTab === "received"
  });
  
  const { 
    data: sentMessages = [] as Message[],
    isLoading: isLoadingSent,
    refetch: refetchSent
  } = useQuery<Message[]>({
    queryKey: ["/api/messages/sent"],
    queryFn: getQueryFn<Message[]>({ on401: "throw" }),
    enabled: activeTab === "sent"
  });
  
  const messages = activeTab === "received" ? receivedMessages : sentMessages;
  const isLoading = activeTab === "received" ? isLoadingReceived : isLoadingSent;
  
  // Mark message as read
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
  
  // Delete message
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
  
  // Format date for display
  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, "dd/MM/yyyy HH:mm", { locale: it });
  };
  
  // View message details
  const handleViewMessage = async (message: Message) => {
    setSelectedMessage(message);
    
    // If message is unread and user is the recipient, mark it as read
    if (!message.isRead && activeTab === "received") {
      await markAsReadMutation.mutateAsync(message.id);
    }
  };
  
  // Handle message deletion
  const handleDeleteMessage = (messageId: number) => {
    if (confirm("Sei sicuro di voler eliminare questo messaggio?")) {
      deleteMessageMutation.mutate(messageId);
    }
  };
  
  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value as "received" | "sent");
    setSelectedMessage(null);
  };
  
  // Refresh messages
  const handleRefresh = () => {
    if (activeTab === "received") {
      refetchReceived();
    } else {
      refetchSent();
    }
  };
  
  const handleComposeFinished = () => {
    setComposeMode(false);
    if (activeTab === "sent") {
      refetchSent();
    }
  };
  
  return (
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
        <MessageComposer 
          onCancel={() => setComposeMode(false)} 
          onSend={handleComposeFinished}
        />
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
                ) : Array.isArray(messages) && messages.length === 0 ? (
                  <div className="text-center p-6 text-muted-foreground">
                    <MessageSquare className="mx-auto h-12 w-12 opacity-20" />
                    <p className="mt-2">Nessun messaggio {activeTab === "received" ? "ricevuto" : "inviato"}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {Array.isArray(messages) && messages.map((message: Message) => (
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
                          {formatMessageDate(message.createdAt.toString())}
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
                        {activeTab === "received" ? "Da" : "A"}: {selectedMessage.fromUserId} • {formatMessageDate(selectedMessage.createdAt.toString())}
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
                          // TODO: Set default recipient to the sender of the selected message
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
  );
}

// Utility function to generate query function
function getQueryFn<T>({ on401 }: { on401: "throw" | "returnNull" } = { on401: "throw" }) {
  return async function ({ queryKey }: any): Promise<T> {
    const path = queryKey[0];
    if (typeof path !== "string") throw new Error("Invalid path");

    const res = await fetch(path);
    
    if (res.status === 401) {
      if (on401 === "throw") throw new Error("Unauthorized");
      return null as T;
    }
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || "Request failed");
    }
    
    return res.json();
  };
}