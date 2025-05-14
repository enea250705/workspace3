import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

// Form schema for time off request
const timeOffSchema = z.object({
  type: z.enum(["vacation", "personal", "sick"]),
  duration: z.enum(["full_day", "morning", "afternoon", "multi_day"]),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Data di inizio non valida",
  }),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Data di fine non valida",
  }),
  reason: z.string().optional(),
});

export function TimeOffRequest() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Fetch user's time off requests
  const { data: timeOffRequests = [], isLoading } = useQuery({
    queryKey: ["/api/time-off-requests"],
  });
  
  // Create time off request mutation
  const createTimeOffMutation = useMutation({
    mutationFn: (data: z.infer<typeof timeOffSchema>) => 
      apiRequest("POST", "/api/time-off-requests", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-off-requests"] });
      form.reset({
        type: "vacation",
        duration: "full_day",
        startDate: "",
        endDate: "",
        reason: "",
      });
      toast({
        title: "Richiesta inviata",
        description: "La tua richiesta è stata inviata con successo.",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'invio della richiesta.",
        variant: "destructive",
      });
    }
  });
  
  // Set up form with validation
  const form = useForm<z.infer<typeof timeOffSchema>>({
    resolver: zodResolver(timeOffSchema),
    defaultValues: {
      type: "vacation",
      duration: "full_day",
      startDate: "",
      endDate: "",
      reason: "",
    },
  });
  
  // Watch duration to conditionally show end date
  const duration = form.watch("duration");
  const type = form.watch("type");
  
  // Handle form submission
  const onSubmit = (data: z.infer<typeof timeOffSchema>) => {
    // If single day, set end date to start date
    if (data.duration !== "multi_day") {
      data.endDate = data.startDate;
    }
    
    createTimeOffMutation.mutate(data);
  };
  
  return (
    <Card className="mb-6">
      <CardHeader className="px-4 py-3 border-b">
        <CardTitle className="text-base font-medium">Richiedi Ferie o Permessi</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo di Richiesta</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="vacation">Ferie</SelectItem>
                        <SelectItem value="personal">Permesso Personale</SelectItem>
                        <SelectItem value="sick">Malattia</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Durata</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona durata" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="full_day">Giornata Intera</SelectItem>
                        <SelectItem value="morning">Mezza Giornata (Mattina)</SelectItem>
                        <SelectItem value="afternoon">Mezza Giornata (Pomeriggio)</SelectItem>
                        <SelectItem value="multi_day">Più Giorni</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Inizio</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {duration === "multi_day" && (
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Fine</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
            
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo (opzionale)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Fornisci ulteriori dettagli sulla tua richiesta"
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                className="mr-2"
                onClick={() => form.reset()}
              >
                Cancella
              </Button>
              <Button 
                type="submit"
                disabled={createTimeOffMutation.isPending}
              >
                {createTimeOffMutation.isPending ? (
                  <>
                    <span className="material-icons animate-spin mr-1">sync</span>
                    Invio in corso...
                  </>
                ) : "Invia Richiesta"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export function TimeOffList() {
  const { data: timeOffRequests = [], isLoading } = useQuery({
    queryKey: ["/api/time-off-requests"],
  });
  
  // Sort requests by date (newest first)
  const sortedRequests = [...timeOffRequests].sort(
    (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
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
      case "pending":
        return { label: "In attesa", color: "bg-yellow-100 text-yellow-800" };
      case "approved":
        return { label: "Approvata", color: "bg-green-100 text-green-800" };
      case "rejected":
        return { label: "Rifiutata", color: "bg-red-100 text-red-800" };
      default:
        return { label: status, color: "bg-gray-100 text-gray-800" };
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
    <Card>
      <CardHeader className="px-4 py-3 border-b">
        <CardTitle className="text-base font-medium">Le Mie Richieste</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {isLoading ? (
          <div className="py-8 text-center">
            <span className="material-icons animate-spin text-primary">sync</span>
            <p className="mt-2 text-sm text-gray-500">Caricamento richieste...</p>
          </div>
        ) : sortedRequests.length === 0 ? (
          <div className="py-8 text-center">
            <span className="material-icons text-4xl text-gray-400">event_busy</span>
            <p className="mt-2 text-gray-500">Nessuna richiesta effettuata</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedRequests.map((request: any) => {
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
                          request.status === "approved" 
                            ? "text-success" 
                            : request.status === "rejected"
                            ? "text-error"
                            : "text-warning"
                        }`}>
                          {request.status === "approved" 
                            ? "check_circle" 
                            : request.status === "rejected"
                            ? "cancel"
                            : "pending"}
                        </span>
                        <p className="text-sm font-medium">{formatRequestType(request.type)}</p>
                        <span className={`ml-3 px-2 py-0.5 rounded-full text-xs ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      
                      <div className="ml-6 space-y-1">
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Periodo:</span> {formatDate(request.startDate)} 
                          {request.startDate !== request.endDate && ` - ${formatDate(request.endDate)}`}
                        </p>
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Durata:</span> {formatDuration(request.duration)}
                        </p>
                        {request.reason && (
                          <p className="text-xs text-gray-600">
                            <span className="font-medium">Motivo:</span> {request.reason}
                          </p>
                        )}
                        <p className="text-xs text-gray-500">
                          Richiesto il {formatDate(request.createdAt)}
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
