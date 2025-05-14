import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, addDays, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Definiamo lo schema per il form di generazione automatica
const formSchema = z.object({
  startDate: z.date({
    required_error: "Seleziona una data di inizio",
  }),
  userRoles: z.record(z.string(), z.boolean()).optional(),
  minHoursPerEmployee: z.number().min(0).max(40),
  maxHoursPerEmployee: z.number().min(0).max(40),
  startHour: z.string(),
  endHour: z.string(),
  distributeEvenly: z.boolean().default(true),
  respectTimeOffRequests: z.boolean().default(true),
});

export function ScheduleAutoGenerator({ onScheduleGenerated }: { onScheduleGenerated: (scheduleData: any) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [previewTable, setPreviewTable] = useState<any[][]>([]);
  const [selectedTab, setSelectedTab] = useState<string>("settings");
  
  // Recupera la lista di utenti
  const { data: users = [], isLoading: isLoadingUsers } = useQuery<any[]>({
    queryKey: ["/api/users"],
    select: (data) => data.filter(user => user.isActive)
  });
  
  // Recupera le richieste di ferie approvate
  const { data: approvedTimeOffs = [], isLoading: isLoadingTimeOffs } = useQuery<any[]>({
    queryKey: ["/api/time-off-requests"],
    select: (data) => data.filter(request => request.status === "approved")
  });
  
  // Inizializza il form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      startDate: new Date(),
      minHoursPerEmployee: 20,
      maxHoursPerEmployee: 40,
      startHour: "08:00",
      endHour: "18:00",
      distributeEvenly: true,
      respectTimeOffRequests: true,
      userRoles: {}
    },
  });
  
  // Funzione per formattare l'ora
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    return `${hours}:${minutes}`;
  };
  
  // Inizializza userRoles quando gli utenti sono caricati
  useEffect(() => {
    if (users.length > 0) {
      const userRoles: Record<string, boolean> = {};
      users.forEach(user => {
        if (user.role !== "admin") {
          userRoles[user.id] = true;
        }
      });
      form.setValue("userRoles", userRoles);
    }
  }, [users, form]);
  
  // Funzione per generare il calendario
  const generateSchedule = useMutation({
    mutationFn: (data: z.infer<typeof formSchema>) => {
      // Converti i dati del form in un formato adatto per l'API
      const selectedUserIds = Object.entries(data.userRoles || {})
        .filter(([, isSelected]) => isSelected)
        .map(([userId]) => parseInt(userId));
      
      const payload = {
        startDate: format(data.startDate, "yyyy-MM-dd"),
        endDate: format(addDays(data.startDate, 6), "yyyy-MM-dd"),
        userIds: selectedUserIds,
        settings: {
          minHoursPerEmployee: data.minHoursPerEmployee,
          maxHoursPerEmployee: data.maxHoursPerEmployee,
          startHour: data.startHour,
          endHour: data.endHour,
          distributeEvenly: data.distributeEvenly,
          respectTimeOffRequests: data.respectTimeOffRequests
        }
      };
      
      return apiRequest("POST", "/api/schedules/auto-generate", payload);
    },
    onSuccess: (data) => {
      toast({
        title: "Pianificazione generata",
        description: "La pianificazione è stata generata con successo."
      });
      
      // Passa i dati generati al componente parent
      onScheduleGenerated(data);
      
      // Passa alla tab di anteprima
      setSelectedTab("preview");
      
      // Invalida le query
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la generazione della pianificazione",
        variant: "destructive",
      });
    }
  });
  
  // Funzione per generare un'anteprima della pianificazione
  const previewSchedule = useMutation({
    mutationFn: (data: z.infer<typeof formSchema>) => {
      // Converti i dati del form come sopra
      const selectedUserIds = Object.entries(data.userRoles || {})
        .filter(([, isSelected]) => isSelected)
        .map(([userId]) => parseInt(userId));
      
      const payload = {
        startDate: format(data.startDate, "yyyy-MM-dd"),
        endDate: format(addDays(data.startDate, 6), "yyyy-MM-dd"),
        userIds: selectedUserIds,
        settings: {
          minHoursPerEmployee: data.minHoursPerEmployee,
          maxHoursPerEmployee: data.maxHoursPerEmployee,
          startHour: data.startHour,
          endHour: data.endHour,
          distributeEvenly: data.distributeEvenly,
          respectTimeOffRequests: data.respectTimeOffRequests
        }
      };
      
      return apiRequest("POST", "/api/schedules/preview", payload);
    },
    onSuccess: (data) => {
      // Trasforma i dati in una matrice per il rendering della tabella
      const employeeShifts = transformPreviewData(data, form.getValues("startDate"));
      setPreviewTable(employeeShifts);
      setSelectedTab("preview");
    },
    onError: () => {
      toast({
        title: "Errore anteprima",
        description: "Impossibile generare l'anteprima della pianificazione",
        variant: "destructive",
      });
    }
  });
  
  // Funzione per trasformare i dati della preview in una matrice
  const transformPreviewData = (data: any, startDate: Date) => {
    // Creiamo una matrice vuota per tutti i dipendenti e i giorni
    const selectedUserIds = Object.entries(form.getValues("userRoles") || {})
      .filter(([, isSelected]) => isSelected)
      .map(([userId]) => parseInt(userId));
      
    const employeeShifts: any[][] = [];
    
    // Per ogni dipendente, aggiungiamo una riga alla matrice
    selectedUserIds.forEach(userId => {
      const user = users.find(u => u.id === userId);
      if (!user) return;
      
      const row = [user.name]; // La prima colonna è il nome del dipendente
      
      // Per ciascuno dei 7 giorni, aggiungiamo le informazioni sul turno
      for (let i = 0; i < 7; i++) {
        const currentDate = addDays(startDate, i);
        const formattedDate = format(currentDate, "yyyy-MM-dd");
        
        // Cerchiamo i turni per questo dipendente in questo giorno
        const shifts = data.shifts.filter((shift: any) => 
          shift.userId === userId && shift.day === formattedDate
        );
        
        if (shifts.length > 0) {
          // Ordiniamo i turni per ora di inizio
          shifts.sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));
          
          // Formattiamo gli orari del turno
          const shiftTimes = shifts.map((shift: any) => 
            `${formatTime(shift.startTime)}-${formatTime(shift.endTime)}`
          ).join(", ");
          
          row.push(shiftTimes);
        } else {
          // Controlliamo se il dipendente ha ferie approvate per questo giorno
          const hasTimeOff = approvedTimeOffs.some(request => 
            request.userId === userId &&
            new Date(request.startDate) <= currentDate &&
            new Date(request.endDate) >= currentDate
          );
          
          row.push(hasTimeOff ? "Assente" : "-");
        }
      }
      
      // Aggiungiamo il totale delle ore settimanali
      const totalHours = data.shifts
        .filter((shift: any) => shift.userId === userId)
        .reduce((sum: number, shift: any) => {
          const startTime = new Date(`2000-01-01T${shift.startTime}`);
          const endTime = new Date(`2000-01-01T${shift.endTime}`);
          const diffHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
          return sum + diffHours;
        }, 0);
      
      row.push(`${totalHours.toFixed(1)} ore`);
      
      employeeShifts.push(row);
    });
    
    return employeeShifts;
  };
  
  // Funzione per gestire l'invio del form
  function onSubmit(values: z.infer<typeof formSchema>) {
    // Assicuriamoci che ci siano utenti selezionati
    const selectedUserIds = Object.entries(values.userRoles || {})
      .filter(([, isSelected]) => isSelected)
      .map(([userId]) => parseInt(userId));
    
    if (selectedUserIds.length === 0) {
      toast({
        title: "Errore",
        description: "Seleziona almeno un dipendente",
        variant: "destructive",
      });
      return;
    }
    
    // Se min > max, scambiali
    if (values.minHoursPerEmployee > values.maxHoursPerEmployee) {
      const temp = values.minHoursPerEmployee;
      form.setValue("minHoursPerEmployee", values.maxHoursPerEmployee);
      form.setValue("maxHoursPerEmployee", temp);
    }
    
    // Genera la pianificazione
    generateSchedule.mutate(values);
  }
  
  // Funzione per generare l'anteprima
  function handlePreview() {
    if (form.formState.isValid) {
      const values = form.getValues();
      
      // Assicuriamoci che ci siano utenti selezionati
      const selectedUserIds = Object.entries(values.userRoles || {})
        .filter(([, isSelected]) => isSelected)
        .map(([userId]) => parseInt(userId));
      
      if (selectedUserIds.length === 0) {
        toast({
          title: "Errore",
          description: "Seleziona almeno un dipendente",
          variant: "destructive",
        });
        return;
      }
      
      // Se min > max, scambiali
      if (values.minHoursPerEmployee > values.maxHoursPerEmployee) {
        const temp = values.minHoursPerEmployee;
        form.setValue("minHoursPerEmployee", values.maxHoursPerEmployee);
        form.setValue("maxHoursPerEmployee", temp);
      }
      
      // Genera l'anteprima
      previewSchedule.mutate(values);
    } else {
      // Trigger validation to show errors
      form.trigger();
    }
  }
  
  // Se sta caricando gli utenti o le richieste
  if (isLoadingUsers || isLoadingTimeOffs) {
    return (
      <Card className="bg-white animate-pulse">
        <CardHeader>
          <div className="h-6 w-64 bg-gray-200 rounded"></div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-12 w-full bg-gray-200 rounded"></div>
            <div className="h-12 w-full bg-gray-200 rounded"></div>
            <div className="h-12 w-full bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle>Generazione automatica turni</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="w-full mb-4">
            <TabsTrigger value="settings" className="flex-1">Impostazioni</TabsTrigger>
            <TabsTrigger value="preview" className="flex-1">Anteprima</TabsTrigger>
          </TabsList>
          
          <TabsContent value="settings">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Data di inizio settimana</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className="w-full pl-3 text-left font-normal"
                            >
                              {field.value ? (
                                format(field.value, "EEEE d MMMM yyyy", { locale: it })
                              ) : (
                                <span>Seleziona data</span>
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div>
                  <FormLabel>Dipendenti da pianificare</FormLabel>
                  <div className="border rounded-md p-4 mt-2 space-y-2 max-h-48 overflow-y-auto">
                    {users
                      .filter(user => user.role !== "admin")
                      .map(user => (
                        <FormField
                          key={user.id}
                          control={form.control}
                          name={`userRoles.${user.id}`}
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="font-normal text-sm">
                                {user.name} - {user.position || "Dipendente"}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="startHour"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ora di inizio</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Ora inizio" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Array.from({ length: 24 }).map((_, i) => {
                              const hour = i.toString().padStart(2, "0");
                              return (
                                <SelectItem key={`${hour}:00`} value={`${hour}:00`}>
                                  {`${hour}:00`}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="endHour"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ora di fine</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Ora fine" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Array.from({ length: 24 }).map((_, i) => {
                              const hour = i.toString().padStart(2, "0");
                              return (
                                <SelectItem key={`${hour}:00`} value={`${hour}:00`}>
                                  {`${hour}:00`}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="space-y-6">
                  <FormField
                    control={form.control}
                    name="minHoursPerEmployee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ore minime settimanali per dipendente: {field.value}</FormLabel>
                        <FormControl>
                          <Slider
                            min={0}
                            max={40}
                            step={1}
                            value={[field.value]}
                            onValueChange={(value) => field.onChange(value[0])}
                            className="py-4"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="maxHoursPerEmployee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ore massime settimanali per dipendente: {field.value}</FormLabel>
                        <FormControl>
                          <Slider
                            min={0}
                            max={40}
                            step={1}
                            value={[field.value]}
                            onValueChange={(value) => field.onChange(value[0])}
                            className="py-4"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="distributeEvenly"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">
                          Distribuisci equamente le ore
                        </FormLabel>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="respectTimeOffRequests"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">
                          Rispetta richieste ferie/permessi
                        </FormLabel>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="flex gap-3 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={handlePreview}
                    disabled={previewSchedule.isPending}
                  >
                    {previewSchedule.isPending ? (
                      <>
                        <span className="material-icons animate-spin mr-2">sync</span>
                        Generazione...
                      </>
                    ) : (
                      "Genera anteprima"
                    )}
                  </Button>
                  
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={generateSchedule.isPending}
                  >
                    {generateSchedule.isPending ? (
                      <>
                        <span className="material-icons animate-spin mr-2">sync</span>
                        Generazione...
                      </>
                    ) : (
                      "Genera e salva turni"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
          
          <TabsContent value="preview">
            {previewTable.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border p-2 bg-gray-50">Dipendente</th>
                      {Array.from({ length: 7 }).map((_, i) => {
                        const day = addDays(form.getValues("startDate"), i);
                        return (
                          <th key={i} className="border p-2 bg-gray-50">
                            {format(day, "EEE d/M", { locale: it })}
                          </th>
                        );
                      })}
                      <th className="border p-2 bg-gray-50">Totale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewTable.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td 
                            key={cellIndex} 
                            className={`border p-2 text-center ${cellIndex === 0 ? "font-medium text-left" : ""} ${
                              cell === "Assente" ? "bg-red-50 text-red-600" : ""
                            }`}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>Configura e genera un'anteprima della pianificazione per visualizzarla qui.</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setSelectedTab("settings")}
                >
                  Torna alle impostazioni
                </Button>
              </div>
            )}
            
            {previewTable.length > 0 && (
              <div className="mt-6 flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setSelectedTab("settings")}
                >
                  Modifica impostazioni
                </Button>
                
                <Button
                  onClick={form.handleSubmit(onSubmit)}
                  disabled={generateSchedule.isPending}
                >
                  {generateSchedule.isPending ? (
                    <>
                      <span className="material-icons animate-spin mr-2">sync</span>
                      Generazione...
                    </>
                  ) : (
                    "Conferma e salva turni"
                  )}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}