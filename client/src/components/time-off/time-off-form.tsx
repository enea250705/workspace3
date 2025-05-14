import { useState, useEffect } from "react";
import { z } from "zod";
import { format, addDays, isSameDay } from "date-fns";
import { it } from "date-fns/locale";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger 
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const formSchema = z.object({
  type: z.string(),
  startDate: z.date({
    required_error: "Seleziona una data di inizio",
  }),
  endDate: z.date({
    required_error: "Seleziona una data di fine",
  }),
  duration: z.string(),
  reason: z.string().optional(),
}).refine(data => {
  return data.startDate <= data.endDate;
}, {
  message: "La data di fine deve essere successiva o uguale alla data di inizio",
  path: ["endDate"],
});

export function TimeOffRequestForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isStartDateOpen, setIsStartDateOpen] = useState(false);
  const [isEndDateOpen, setIsEndDateOpen] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "vacation",
      duration: "full_day",
      reason: "",
    },
  });
  
  // Aggiorna la durata quando cambia il tipo di richiesta o le date
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "type" || name === "startDate" || name === "endDate") {
        const requestType = form.getValues("type");
        const startDate = form.getValues("startDate");
        const endDate = form.getValues("endDate");
        
        if (!startDate || !endDate) return;
        
        // Imposta automaticamente la data di fine uguale a quella di inizio se non è ancora impostata
        if (name === "startDate" && !form.getValues("endDate")) {
          form.setValue("endDate", startDate);
        }
        
        const isSameDay = startDate.toDateString() === endDate.toDateString();
        const isPersonalLeave = requestType === "personal";
        
        // Se non è permesso personale o è su più giorni, forza a "full_day"
        if (!isPersonalLeave || (isPersonalLeave && !isSameDay)) {
          form.setValue("duration", "full_day");
        }
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form]);
  
  const createTimeOffRequest = useMutation({
    mutationFn: (data: z.infer<typeof formSchema>) => {
      const payload = {
        ...data,
        startDate: format(data.startDate, "yyyy-MM-dd"),
        endDate: format(data.endDate, "yyyy-MM-dd"),
      };
      
      // Salva i dati di debug
      setDebugInfo({
        requestData: payload,
        timestamp: new Date().toISOString(),
      });
      
      return apiRequest("POST", "/api/time-off-requests", payload);
    },
    onSuccess: (response) => {
      // Aggiorna le informazioni di debug con la risposta
      setDebugInfo(prev => ({
        ...prev,
        response: response,
        success: true,
      }));
      
      toast({
        title: "Richiesta inviata",
        description: "La tua richiesta è stata inviata con successo",
      });
      form.reset({
        type: "vacation",
        duration: "full_day",
        reason: "",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/time-off-requests"] });
    },
    onError: (error) => {
      // Aggiorna le informazioni di debug con l'errore
      setDebugInfo(prev => ({
        ...prev,
        error: error,
        success: false,
      }));
      
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'invio della richiesta",
        variant: "destructive",
      });
    },
  });
  
  function onSubmit(values: z.infer<typeof formSchema>) {
    createTimeOffRequest.mutate(values);
  }
  
  // Converti il tipo di assenza in italiano
  const getTypeLabel = (type: string) => {
    switch (type) {
      case "vacation": return "Ferie";
      case "personal": return "Permesso personale";
      case "sick": return "Malattia";
      default: return type;
    }
  };
  
  // Aggiungi scorciatoie rapide per le date
  const quickDateOptions = [
    { label: "Oggi", value: new Date() },
    { label: "Domani", value: addDays(new Date(), 1) },
    { label: "Dopodomani", value: addDays(new Date(), 2) },
    { label: "Tra una settimana", value: addDays(new Date(), 7) },
  ];
  
  return (
    <Card className="bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Nuova richiesta di assenza</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo di assenza</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleziona il tipo di assenza" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="vacation">Ferie</SelectItem>
                      <SelectItem value="personal">Permesso personale</SelectItem>
                      <SelectItem value="sick">Malattia</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data di inizio</FormLabel>
                    <div className="relative">
                      <Popover open={isStartDateOpen} onOpenChange={setIsStartDateOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <span className="material-icons mr-2 text-muted-foreground">today</span>
                            {field.value ? (
                              format(field.value, "d MMMM yyyy", { locale: it })
                            ) : (
                              "Seleziona data"
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <div className="p-2 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              {quickDateOptions.map((option) => (
                                <Button
                                  key={option.label}
                                  variant="outline"
                                  className="text-xs h-8"
                                  onClick={() => {
                                    field.onChange(option.value);
                                    setIsStartDateOpen(false);
                                  }}
                                >
                                  {option.label}
                                </Button>
                              ))}
                            </div>
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={(date) => {
                                field.onChange(date);
                                setIsStartDateOpen(false);
                              }}
                              disabled={(date) => date < new Date()}
                              initialFocus
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data di fine</FormLabel>
                    <div className="relative">
                      <Popover open={isEndDateOpen} onOpenChange={setIsEndDateOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <span className="material-icons mr-2 text-muted-foreground">event</span>
                            {field.value ? (
                              format(field.value, "d MMMM yyyy", { locale: it })
                            ) : (
                              "Seleziona data"
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <div className="p-2 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              {quickDateOptions.map((option) => (
                                <Button
                                  key={option.label}
                                  variant="outline"
                                  className="text-xs h-8"
                                  onClick={() => {
                                    const startDate = form.getValues("startDate");
                                    if (startDate && option.value < startDate) return;
                                    field.onChange(option.value);
                                    setIsEndDateOpen(false);
                                  }}
                                  disabled={option.value < form.getValues("startDate")}
                                >
                                  {option.label}
                                </Button>
                              ))}
                            </div>
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={(date) => {
                                field.onChange(date);
                                setIsEndDateOpen(false);
                              }}
                              disabled={(date) => {
                                const startDate = form.getValues("startDate");
                                return date < (startDate || new Date());
                              }}
                              initialFocus
                            />
                          </div>
                        </PopoverContent>
                      </Popover>
                      {field.value && form.getValues("startDate") && 
                      form.getValues("startDate") && field.value &&
                      isSameDay(field.value, form.getValues("startDate")) && (
                        <div className="text-xs text-muted-foreground mt-1 ml-1">
                          Singolo giorno
                        </div>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => {
                const requestType = form.watch("type");
                const startDateValue = form.watch("startDate");
                const endDateValue = form.watch("endDate");
                const datesAreOnSameDay = startDateValue && endDateValue && 
                  isSameDay(startDateValue, endDateValue);
                const isPersonalLeave = requestType === "personal";
                
                // Se non è permesso personale o è su più giorni, forza a "full_day"
                if (!isPersonalLeave || (isPersonalLeave && !datesAreOnSameDay)) {
                  if (field.value !== "full_day") {
                    setTimeout(() => form.setValue("duration", "full_day"), 0);
                  }
                }
                
                // Non mostrare questa sezione se non è possibile selezionare opzioni diverse
                if (!isPersonalLeave || (isPersonalLeave && !datesAreOnSameDay)) {
                  return <></>;
                }
                
                return (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <FormItem className="space-y-2">
                      <FormLabel>Durata giornaliera</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="full_day" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Giornata intera
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="morning" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Solo mattina
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl>
                              <RadioGroupItem value="afternoon" />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Solo pomeriggio
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  </motion.div>
                );
              }}
            />
            
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo (opzionale)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Inserisci il motivo della richiesta"
                      {...field}
                      className="min-h-[80px] resize-none"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {/* Aggiungi il bottone di debug (visibile solo in development) */}
            <div className="mt-2 text-right">
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => setShowDebugInfo(!showDebugInfo)}
                className="text-xs"
              >
                {showDebugInfo ? "Nascondi Debug" : "Mostra Debug"}
              </Button>
            </div>
            
            {/* Mostra informazioni di debug quando disponibili e richieste */}
            {showDebugInfo && (
              <div className="border rounded p-2 text-xs overflow-auto max-h-[200px] bg-slate-50">
                <h4 className="font-semibold">Stato del form:</h4>
                <pre>{JSON.stringify(form.getValues(), null, 2)}</pre>
                
                {debugInfo && (
                  <>
                    <h4 className="font-semibold mt-2">Debug Invio Richiesta:</h4>
                    <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
                  </>
                )}
                
                <h4 className="font-semibold mt-2">Stato Environment:</h4>
                <pre>
                  {JSON.stringify({
                    browser: navigator.userAgent,
                    screen: `${window.innerWidth}x${window.innerHeight}`,
                    timestamp: new Date().toISOString(),
                  }, null, 2)}
                </pre>
              </div>
            )}
            
            <Button
              type="submit"
              className="w-full"
              disabled={createTimeOffRequest.isPending}
            >
              {createTimeOffRequest.isPending ? (
                <>
                  <span className="material-icons animate-spin mr-2 text-sm">sync</span>
                  Invio in corso...
                </>
              ) : (
                <>
                  <span className="material-icons mr-2 text-sm">send</span>
                  Invia richiesta
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}