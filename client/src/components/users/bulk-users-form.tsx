import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Formato CSV atteso: nome,email,username,password,posizione
const bulkUsersFormSchema = z.object({
  usersData: z.string()
    .min(5, { message: "Inserisci almeno una riga di dati" })
});

type BulkUsersFormValues = z.infer<typeof bulkUsersFormSchema>;

type BulkUsersFormProps = {
  onSubmit: (data: { createdCount: number }) => void;
  onCancel: () => void;
};

export function BulkUsersForm({ onSubmit, onCancel }: BulkUsersFormProps) {
  const [formattingError, setFormattingError] = useState<string | null>(null);
  
  // Initialize form
  const form = useForm<BulkUsersFormValues>({
    resolver: zodResolver(bulkUsersFormSchema),
    defaultValues: {
      usersData: "",
    },
  });
  
  // Create users mutation
  const createUsersMutation = useMutation({
    mutationFn: async (userData: any[]) => {
      const response = await apiRequest("POST", "/api/users/bulk", { users: userData });
      return await response.json();
    },
    onSuccess: (data) => {
      onSubmit(data);
      form.reset();
    },
    onError: (error) => {
      console.error("Error creating users:", error);
      form.setError("root", { 
        message: "Si è verificato un errore durante la creazione degli utenti" 
      });
    },
  });
  
  // Check if CSV is valid
  const parseCSV = (csvText: string): { valid: boolean, data?: any[], error?: string } => {
    try {
      // Rimuovi spazi bianchi extra e righe vuote
      const lines = csvText.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      const parsedData = lines.map((line, index) => {
        const values = line.split(',').map(val => val.trim());
        
        if (values.length < 3) {
          throw new Error(`Riga ${index + 1}: formato non valido, sono richiesti almeno 3 valori`);
        }
        
        const [name, email, username, password, position = ""] = values;
        
        if (!name || !email || !username) {
          throw new Error(`Riga ${index + 1}: nome, email e username sono campi obbligatori`);
        }
        
        return {
          name,
          email,
          username,
          password: password || username, // Se la password è vuota, usa l'username come password
          position,
          role: "employee",
          isActive: true
        };
      });
      
      return { valid: true, data: parsedData };
    } catch (error) {
      if (error instanceof Error) {
        return { valid: false, error: error.message };
      }
      return { valid: false, error: "Formato CSV non valido" };
    }
  };
  
  // Handle form submission
  const handleSubmit = (values: BulkUsersFormValues) => {
    setFormattingError(null);
    
    const parsed = parseCSV(values.usersData);
    if (!parsed.valid) {
      setFormattingError(parsed.error || "Formato non valido");
      return;
    }
    
    if (parsed.data && parsed.data.length > 0) {
      createUsersMutation.mutate(parsed.data);
    } else {
      setFormattingError("Nessun utente da aggiungere");
    }
  };
  
  const csvExample = "Mario Rossi,mario.rossi@example.com,mrossi,password123,Operatore\nGiulia Bianchi,giulia.bianchi@example.com,gbianchi,password456,Amministrativo";
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-4">
        {formattingError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Errore nel formato</AlertTitle>
            <AlertDescription>
              {formattingError}
            </AlertDescription>
          </Alert>
        )}
        
        <FormField
          control={form.control}
          name="usersData"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dati Utenti (CSV)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder={csvExample}
                  className="font-mono h-[200px] w-full max-w-full"
                  {...field} 
                />
              </FormControl>
              <FormDescription className="text-xs sm:text-sm">
                Inserisci un utente per riga nel formato: nome,email,username,password,posizione
                <br />
                La password è opzionale. Se non specificata, verrà usato lo username come password.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {/* Show any form-level errors */}
        {form.formState.errors.root && (
          <div className="text-sm font-medium text-destructive">
            {form.formState.errors.root.message}
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="w-full sm:w-auto"
          >
            Annulla
          </Button>
          <Button 
            type="submit"
            disabled={createUsersMutation.isPending}
            className="w-full sm:w-auto"
          >
            {createUsersMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creazione in corso...
              </>
            ) : (
              "Crea Utenti"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}