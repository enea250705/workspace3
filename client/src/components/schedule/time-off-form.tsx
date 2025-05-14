import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, addDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { it } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const timeOffSchema = z.object({
  type: z.enum(["vacation", "personal", "sick"], {
    required_error: "Seleziona il tipo di richiesta",
  }),
  dateRange: z.object({
    from: z.date({
      required_error: "Seleziona la data di inizio",
    }),
    to: z.date({
      required_error: "Seleziona la data di fine",
    }),
  }),
  duration: z.enum(["full_day", "morning", "afternoon"], {
    required_error: "Seleziona la durata",
  }),
  reason: z.string().optional(),
});

type TimeOffFormValues = z.infer<typeof timeOffSchema>;

export function TimeOffForm() {
  const [isDateRangeOpen, setIsDateRangeOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Create form
  const form = useForm<TimeOffFormValues>({
    resolver: zodResolver(timeOffSchema),
    defaultValues: {
      type: "vacation",
      duration: "full_day",
      reason: "",
    },
  });
  
  // Set up mutation
  const timeOffMutation = useMutation({
    mutationFn: (data: any) => 
      apiRequest("POST", "/api/time-off-requests", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-off-requests"] });
      toast({
        title: "Richiesta inviata",
        description: "La tua richiesta è stata inviata con successo",
      });
      form.reset();
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'invio della richiesta",
        variant: "destructive",
      });
    },
  });
  
  // Handle form submission
  function onSubmit(data: TimeOffFormValues) {
    const { from, to } = data.dateRange;
    
    // Convert the form data to the format expected by the API
    const requestData = {
      type: data.type,
      startDate: format(from, "yyyy-MM-dd"),
      endDate: format(to, "yyyy-MM-dd"),
      duration: data.duration,
      reason: data.reason,
    };
    
    timeOffMutation.mutate(requestData);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo di Richiesta</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona il tipo di richiesta" />
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona la durata" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="full_day">Giornata Intera</SelectItem>
                    <SelectItem value="morning">Mezza Giornata (Mattina)</SelectItem>
                    <SelectItem value="afternoon">Mezza Giornata (Pomeriggio)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="dateRange"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Periodo</FormLabel>
              <Popover open={isDateRangeOpen} onOpenChange={setIsDateRangeOpen}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value?.from ? (
                        field.value.to ? (
                          <>
                            {format(field.value.from, "dd/MM/yyyy", { locale: it })} -{" "}
                            {format(field.value.to, "dd/MM/yyyy", { locale: it })}
                          </>
                        ) : (
                          format(field.value.from, "dd/MM/yyyy", { locale: it })
                        )
                      ) : (
                        <span>Seleziona un periodo</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={field.value}
                    onSelect={(range) => {
                      field.onChange(range);
                      if (range?.from && range?.to) {
                        setIsDateRangeOpen(false);
                      }
                    }}
                    initialFocus
                    numberOfMonths={2}
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>
              <FormDescription>
                Seleziona l'intervallo di date per la tua richiesta.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Motivo (opzionale)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Specifica il motivo della tua richiesta..."
                  className="resize-none"
                  rows={4}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
          >
            Annulla
          </Button>
          <Button 
            type="submit"
            disabled={timeOffMutation.isPending}
          >
            {timeOffMutation.isPending ? 
              "Invio in corso..." : "Invia Richiesta"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
