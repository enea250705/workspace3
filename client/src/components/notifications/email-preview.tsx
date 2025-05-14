import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface EmailPreviewProps {
  open: boolean;
  onClose: () => void;
  emailData: {
    to: string;
    subject: string;
    body: string;
  };
  mailtoUrl: string;
}

export function EmailPreview({ open, onClose, emailData, mailtoUrl }: EmailPreviewProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("preview");
  
  // Funzione per copiare il contenuto della email
  const copyEmailContent = () => {
    const content = `A: ${emailData.to}
Oggetto: ${emailData.subject}

${emailData.body.replace(/<[^>]*>?/gm, '')}`;
    
    navigator.clipboard.writeText(content)
      .then(() => {
        toast({
          title: "Contenuto copiato",
          description: "L'email è stata copiata negli appunti",
        });
      })
      .catch(() => {
        toast({
          title: "Errore",
          description: "Non è stato possibile copiare il contenuto",
          variant: "destructive",
        });
      });
  };
  
  // Funzione per aprire il client di posta predefinito
  const openEmailClient = () => {
    window.open(mailtoUrl, "_blank");
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Anteprima Email</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="preview" className="flex-1">
              Anteprima
            </TabsTrigger>
            <TabsTrigger value="raw" className="flex-1">
              Contenuto Grezzo
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="preview" className="mt-4">
            <div className="border rounded-md p-4 space-y-4">
              <div className="space-y-1">
                <Label>A:</Label>
                <div className="text-sm">{emailData.to}</div>
              </div>
              
              <div className="space-y-1">
                <Label>Oggetto:</Label>
                <div className="text-sm font-medium">{emailData.subject}</div>
              </div>
              
              <div className="space-y-1">
                <Label>Messaggio:</Label>
                <div 
                  className="text-sm border rounded-md p-4 bg-white min-h-[200px]"
                  dangerouslySetInnerHTML={{ __html: emailData.body }}
                />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="raw" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-to">A:</Label>
              <Input id="email-to" value={emailData.to} readOnly />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email-subject">Oggetto:</Label>
              <Input id="email-subject" value={emailData.subject} readOnly />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email-body">Corpo:</Label>
              <Textarea 
                id="email-body" 
                value={emailData.body.replace(/<[^>]*>?/gm, '')} 
                readOnly
                className="min-h-[200px]"
              />
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="flex gap-2 sm:justify-start">
          <Button variant="outline" onClick={copyEmailContent}>
            <span className="material-icons text-lg mr-2">content_copy</span>
            Copia negli appunti
          </Button>
          <Button onClick={openEmailClient}>
            <span className="material-icons text-lg mr-2">email</span>
            Apri nel client email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface BulkEmailPreviewProps {
  open: boolean;
  onClose: () => void;
  emailsData: Array<{
    to: string;
    subject: string;
    body: string;
    mailtoUrl: string;
  }>;
}

export function BulkEmailPreview({ open, onClose, emailsData }: BulkEmailPreviewProps) {
  const { toast } = useToast();
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const copyAllEmails = () => {
    const content = emailsData.map(email => (
      `---\nA: ${email.to}\nOggetto: ${email.subject}\n\n${email.body.replace(/<[^>]*>?/gm, '')}\n---\n`
    )).join('\n');
    
    navigator.clipboard.writeText(content)
      .then(() => {
        toast({
          title: "Contenuto copiato",
          description: `${emailsData.length} email sono state copiate negli appunti`,
        });
      })
      .catch(() => {
        toast({
          title: "Errore",
          description: "Non è stato possibile copiare il contenuto",
          variant: "destructive",
        });
      });
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Anteprima Email di Massa ({emailsData.length} destinatari)
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Seleziona destinatario:</Label>
            <div className="text-sm text-gray-500">
              {selectedIndex + 1} di {emailsData.length}
            </div>
          </div>
          
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIndex(prev => Math.max(0, prev - 1))}
              disabled={selectedIndex === 0}
            >
              <span className="material-icons">arrow_back</span>
            </Button>
            
            <select
              className="flex-1 border rounded-md px-3 py-2"
              value={selectedIndex}
              onChange={(e) => setSelectedIndex(Number(e.target.value))}
            >
              {emailsData.map((email, index) => (
                <option key={index} value={index}>
                  {email.to}
                </option>
              ))}
            </select>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIndex(prev => Math.min(emailsData.length - 1, prev + 1))}
              disabled={selectedIndex === emailsData.length - 1}
            >
              <span className="material-icons">arrow_forward</span>
            </Button>
          </div>
          
          {emailsData[selectedIndex] && (
            <div className="border rounded-md p-4 space-y-4">
              <div className="space-y-1">
                <Label>A:</Label>
                <div className="text-sm">{emailsData[selectedIndex].to}</div>
              </div>
              
              <div className="space-y-1">
                <Label>Oggetto:</Label>
                <div className="text-sm font-medium">{emailsData[selectedIndex].subject}</div>
              </div>
              
              <div className="space-y-1">
                <Label>Messaggio:</Label>
                <div 
                  className="text-sm border rounded-md p-4 bg-white min-h-[200px]"
                  dangerouslySetInnerHTML={{ __html: emailsData[selectedIndex].body }}
                />
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-start">
          <Button variant="outline" onClick={copyAllEmails}>
            <span className="material-icons text-lg mr-2">content_copy</span>
            Copia tutte le email
          </Button>
          
          {emailsData[selectedIndex] && (
            <Button onClick={() => window.open(emailsData[selectedIndex].mailtoUrl, "_blank")}>
              <span className="material-icons text-lg mr-2">email</span>
              Apri questa email nel client
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}