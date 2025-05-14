import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/layout";
import { ScheduleBuilder } from "@/components/schedule/schedule-builder";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BulkEmailPreview } from "@/components/notifications/email-preview";
import { ScheduleAutoGenerator } from "@/components/schedule/auto-generator/auto-generator";

// Date utilities
import { format, startOfWeek, addDays, isBefore } from "date-fns";
import { it } from "date-fns/locale";

export default function Schedule() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const now = new Date();
    return startOfWeek(now, { weekStartsOn: 1 }); // Start week on Monday
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login");
    }
    
    if (!isLoading && isAuthenticated && user?.role !== "admin") {
      navigate("/my-schedule");
    }
  }, [isLoading, isAuthenticated, navigate, user]);

  // State for custom date selection
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Calculate end of week (Sunday) - use custom dates if selected
  const startDateToUse = customStartDate || selectedWeek;
  const endOfWeek = customEndDate || addDays(selectedWeek, 6);

  // Format date range for display
  const dateRangeText = `${format(startDateToUse, "d MMMM", { locale: it })} - ${format(
    endOfWeek,
    "d MMMM yyyy",
    { locale: it }
  )}`;

  // Fetch existing schedule data for the selected week
  const { data: existingSchedule = {}, isLoading: isScheduleLoading } = useQuery<any>({
    queryKey: ["/api/schedules", { startDate: format(selectedWeek, "yyyy-MM-dd") }],
  });

  // Fetch users for populating the schedule
  const { data: users = [], isLoading: isUsersLoading } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  // Fetch shifts for the schedule if it exists
  const { data: shifts = [], isLoading: isShiftsLoading } = useQuery<any[]>({
    queryKey: [`/api/schedules/${existingSchedule?.id}/shifts`],
    enabled: !!existingSchedule?.id,
  });

  // Create schedule mutation
  const createScheduleMutation = useMutation({
    mutationFn: (scheduleData: any) => apiRequest("POST", "/api/schedules", scheduleData),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      toast({
        title: "Turni creati",
        description: "La pianificazione è stata creata con successo.",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la creazione della pianificazione.",
        variant: "destructive",
      });
    },
  });

  // Publish schedule mutation
  const publishScheduleMutation = useMutation({
    mutationFn: (scheduleId: number) =>
      apiRequest("POST", `/api/schedules/${scheduleId}/publish`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schedules/1/shifts"] });
    },
    onError: () => {
      toast({
        title: "Errore di pubblicazione",
        description: "Si è verificato un errore durante la pubblicazione della pianificazione.",
        variant: "destructive",
      });
    },
  });

  // State for showing auto-generate modal
  const [showAutoGenerator, setShowAutoGenerator] = useState(false);
  
  // Handle auto-generate schedule
  const handleAutoGenerate = () => {
    // Se non ci sono date personalizzate, chiediamo di selezionarle
    if (!customStartDate || !customEndDate) {
      setShowDatePicker(true);
      return;
    }
    
    // Mostra il generatore automatico
    setShowAutoGenerator(true);
  };
  
  // Handle schedule data received from auto-generator
  const handleScheduleGenerated = (scheduleData: any) => {
    // Nascondi il generatore automatico
    setShowAutoGenerator(false);
    
    // Invalida la cache per riflettere i cambiamenti
    queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
    
    // Mostra il builder con i dati generati
    setShowScheduleBuilder(true);
  };

  // Stato per l'anteprima delle email
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [bulkEmailsData, setBulkEmailsData] = useState<Array<{
    to: string;
    subject: string;
    body: string;
    mailtoUrl: string;
  }>>([]);
  
  // Handle publish schedule
  const handlePublish = () => {
    if (existingSchedule?.id) {
      // Pubblica immediatamente lo schedule
      publishScheduleMutation.mutate(existingSchedule.id);
      
      // Mostra un toast di successo solo all'amministratore
      toast({
        title: "Turni pubblicati con successo!",
        description: "La pianificazione è stata registrata nel sistema.",
        variant: "default",
      });
      
      // Rimuova tutta la parte di preparazione email ai dipendenti
    }
  };
          // Filtra i turni per questo dipendente
          const userShifts = shifts.filter((s: any) => s.userId === user.id);
          
          // Formatta le date
          const startDateFormatted = format(new Date(existingSchedule.startDate), "d MMMM yyyy", { locale: it });
          const endDateFormatted = format(new Date(existingSchedule.endDate), "d MMMM yyyy", { locale: it });
          
          // Crea la tabella HTML con i turni
          let shiftsTable = '';
          if (userShifts && userShifts.length > 0) {
            shiftsTable = '<table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">';
            shiftsTable += '<tr><th>Giorno</th><th>Orario</th><th>Tipo</th><th>Note</th></tr>';
            
            userShifts.forEach((shift: any) => {
              const shiftType = shift.type === 'work' ? 'Lavoro' : 
                              shift.type === 'vacation' ? 'Ferie' : 'Permesso';
              
              shiftsTable += `<tr>
                <td>${shift.day}</td>
                <td>${shift.startTime} - ${shift.endTime}</td>
                <td>${shiftType}</td>
                <td>${shift.notes || ''}</td>
              </tr>`;
            });
            
            shiftsTable += '</table>';
          } else {
            shiftsTable = '<p>Nessun turno pianificato per questo periodo.</p>';
          }
          
          // Crea il corpo dell'email
          const emailBody = `
            <p>Gentile ${user.name},</p>
            <p>È stata pubblicata la pianificazione dei turni per il periodo ${startDateFormatted} - ${endDateFormatted}.</p>
            
            <h3>I tuoi turni:</h3>
            ${shiftsTable}
            
            <p>Per visualizzare tutti i dettagli, accedi alla piattaforma dalla sezione "I miei turni".</p>
            
            <p>Cordiali saluti,<br/>
            Gestione del Personale</p>
          `;
          
          // Pulisce il body per il mailto URL
          const cleanBody = emailBody.replace(/<[^>]*>?/gm, '').replace(/\n/g, '%0A');
          
          // Crea un mailto URL
          const subject = `Pianificazione turni: ${startDateFormatted} - ${endDateFormatted}`;
          const mailtoUrl = `mailto:${user.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(cleanBody)}`;
          
          return {
            to: user.email,
            subject,
            body: emailBody,
            mailtoUrl
          };
        });
        
        setBulkEmailsData(emailsData);
        setShowEmailPreview(true);
      } else {
        // Se non ci sono dipendenti, pubblica direttamente
        publishScheduleMutation.mutate(existingSchedule.id);
      }
    }
  };

  // Handle export PDF
  const handleExportPdf = () => {
    if (!existingSchedule) {
      toast({
        title: "Nessuna pianificazione",
        description: "Crea prima una pianificazione per poterla esportare in PDF.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Create content for PDF
      let pdfContent = `
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; font-size: 12px; }
            h1 { font-size: 18px; margin-bottom: 10px; }
            h2 { font-size: 14px; margin-bottom: 5px; color: #666; }
            table { border-collapse: collapse; width: 100%; margin: 10px 0; }
            th, td { border: 1px solid #ccc; padding: 5px; text-align: center; }
            .name-cell { text-align: left; font-weight: bold; width: 150px; }
            .notes-cell { width: 120px; }
            .total-cell { width: 60px; }
            .working { background-color: #e6f0ff; }
            .vacation { background-color: #ffe6e6; }
            .leave { background-color: #fff9e6; }
            .page-break { page-break-after: always; }
            .legend { margin: 10px 0; display: flex; }
            .legend-item { margin-right: 15px; display: flex; align-items: center; }
            .legend-color { width: 15px; height: 15px; display: inline-block; margin-right: 5px; border: 1px solid #ccc; }
            .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>Pianificazione Turni</h1>
              <h2>Settimana: ${format(new Date(existingSchedule.startDate), "d MMMM", { locale: it })} - 
              ${format(new Date(existingSchedule.endDate), "d MMMM yyyy", { locale: it })}</h2>
            </div>
            <div>
              <p>Data: ${format(new Date(), "dd/MM/yyyy")}</p>
              <p>Stato: ${existingSchedule.isPublished ? 'Pubblicato' : 'Bozza'}</p>
            </div>
          </div>
          
          <div class="legend">
            <div class="legend-item"><span class="legend-color working"></span> In servizio (X)</div>
            <div class="legend-item"><span class="legend-color vacation"></span> Ferie (F)</div>
            <div class="legend-item"><span class="legend-color leave"></span> Permesso (P)</div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th class="name-cell">Dipendente</th>
                <th>Lunedì</th>
                <th>Martedì</th>
                <th>Mercoledì</th>
                <th>Giovedì</th>
                <th>Venerdì</th>
                <th>Sabato</th>
                <th>Domenica</th>
                <th class="total-cell">Totale Ore</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      // Add employee rows with shift summary
      users
        .filter((user: any) => user.role === "employee" && user.isActive)
        .forEach((user: any) => {
          let userTotalHours = 0;
          
          pdfContent += `
            <tr>
              <td class="name-cell">${user.name}</td>
          `;
          
          // Add days of week
          ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'].forEach(day => {
            const userShifts = shifts.filter((s: any) => s.userId === user.id && s.day === day);
            let daySummary = '-';
            let cellClass = '';
            
            if (userShifts.length > 0) {
              // Sort shifts by start time
              userShifts.sort((a: any, b: any) => {
                return a.startTime.localeCompare(b.startTime);
              });
              
              // Create summary of shifts
              daySummary = userShifts.map((shift: any) => {
                const hours = calculateHoursFromShift(shift);
                userTotalHours += hours;
                
                if (shift.type === 'work') {
                  cellClass = 'working';
                  return `${shift.startTime}-${shift.endTime}`;
                } else if (shift.type === 'vacation') {
                  cellClass = 'vacation';
                  return 'Ferie';
                } else if (shift.type === 'leave') {
                  cellClass = 'leave';
                  return 'Permesso';
                }
                return '-';
              }).join('<br>');
            }
            
            pdfContent += `<td class="${cellClass}">${daySummary}</td>`;
          });
          
          // Add total hours
          pdfContent += `
            <td class="total-cell">${userTotalHours.toFixed(1)}</td>
          </tr>`;
        });
      
      pdfContent += `
            </tbody>
          </table>
        </body>
        </html>
      `;
      
      // Open in a new window for printing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast({
          title: "Errore",
          description: "Impossibile aprire la finestra di stampa. Controlla che i popup siano abilitati.",
          variant: "destructive",
        });
        return;
      }
      
      printWindow.document.write(pdfContent);
      printWindow.document.close();
      
      // Give time for the page to load then print
      setTimeout(() => {
        printWindow.print();
      }, 500);
      
      toast({
        title: "Esportazione PDF",
        description: "Il documento è stato generato per la stampa.",
      });
      
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'esportazione del PDF.",
        variant: "destructive",
      });
    }
  };
  
  // Calculate hours from a shift
  const calculateHoursFromShift = (shift: any) => {
    const startTimeParts = shift.startTime.split(':').map(Number);
    const endTimeParts = shift.endTime.split(':').map(Number);
    
    let hours = endTimeParts[0] - startTimeParts[0];
    let minutes = endTimeParts[1] - startTimeParts[1];
    
    if (minutes < 0) {
      hours -= 1;
      minutes += 60;
    }
    
    return hours + (minutes / 60);
  };

  // State to show schedule builder without creating a schedule yet
  const [showScheduleBuilder, setShowScheduleBuilder] = useState(false);
  
  // Handle date selection
  const handleDateChange = (type: 'start' | 'end', date: Date | undefined) => {
    if (!date) return;
    if (type === 'start') {
      setCustomStartDate(date);
      // If end date is before start date, update it
      if (customEndDate && isBefore(customEndDate, date)) {
        setCustomEndDate(addDays(date, 6));
      } else if (!customEndDate) {
        // Default to a week range
        setCustomEndDate(addDays(date, 6));
      }
    } else {
      setCustomEndDate(date);
    }
  };
  
  // Create new schedule if none exists for the selected week
  const handleCreateSchedule = () => {
    if (createScheduleMutation.isPending) return;
    
    // If no custom dates selected, show date picker
    if (!customStartDate || !customEndDate) {
      setShowDatePicker(true);
      return;
    }
    
    // Show the schedule builder immediately
    setShowScheduleBuilder(true);
    
    // Create the schedule in the background
    createScheduleMutation.mutate({
      startDate: format(startDateToUse, "yyyy-MM-dd"),
      endDate: format(endOfWeek, "yyyy-MM-dd"),
      isPublished: false,
      createdBy: user?.id,
    });
  };
  
  // Confirm date selection and create schedule
  const handleDateConfirm = () => {
    setShowDatePicker(false);
    
    // Show the schedule builder immediately
    setShowScheduleBuilder(true);
    
    // Create the schedule in the background
    createScheduleMutation.mutate({
      startDate: format(startDateToUse, "yyyy-MM-dd"),
      endDate: format(endOfWeek, "yyyy-MM-dd"),
      isPublished: false,
      createdBy: user?.id,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <span className="material-icons text-primary animate-spin text-4xl">sync</span>
          <p className="mt-4 text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {isScheduleLoading || isUsersLoading || isShiftsLoading ? (
          <div className="flex items-center justify-center h-64 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="text-center">
              <span className="material-icons text-primary animate-spin text-4xl">sync</span>
              <p className="mt-4 text-gray-600">Caricamento pianificazione...</p>
            </div>
          </div>
        ) : showScheduleBuilder && !existingSchedule ? (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">
                Pianificazione Turni: {dateRangeText}
              </h3>
              <div className="text-sm text-gray-500">
                In attesa di salvataggio...
              </div>
            </div>
            <ScheduleBuilder
              scheduleId={null}
              users={users || []}
              startDate={selectedWeek}
              endDate={endOfWeek}
              shifts={[]}
              isPublished={false}
              onPublish={() => {}}
              onAutoGenerate={() => {}}
              onExportPdf={handleExportPdf}
            />
          </div>
        ) : existingSchedule ? (
          <ScheduleBuilder
            scheduleId={existingSchedule?.id || null}
            users={users || []}
            startDate={existingSchedule?.startDate ? new Date(existingSchedule.startDate) : selectedWeek}
            endDate={existingSchedule?.endDate ? new Date(existingSchedule.endDate) : endOfWeek}
            shifts={shifts || []}
            isPublished={existingSchedule?.isPublished || false}
            onPublish={handlePublish}
            onAutoGenerate={handleAutoGenerate}
            onExportPdf={handleExportPdf}
          />
        ) : (
          <div>
            {showDatePicker ? (
              <Card className="bg-white border border-gray-200">
                <CardHeader>
                  <CardTitle>Seleziona il periodo della pianificazione</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                    <div>
                      <Label className="mb-2 block">Data di inizio</Label>
                      <Calendar
                        mode="single"
                        selected={customStartDate || undefined}
                        onSelect={(date) => handleDateChange('start', date)}
                        disabled={(date) => 
                          date < new Date()
                        }
                        className="border border-gray-200 rounded-md"
                      />
                      <div className="text-sm text-gray-500 mt-1">
                        {customStartDate ? format(customStartDate, "EEEE d MMMM yyyy", { locale: it }) : "Seleziona una data"}
                      </div>
                    </div>
                    <div>
                      <Label className="mb-2 block">Data di fine</Label>
                      <Calendar
                        mode="single"
                        selected={customEndDate || undefined}
                        onSelect={(date) => handleDateChange('end', date)}
                        disabled={(date) => 
                          customStartDate ? date < customStartDate : false
                        }
                        className="border border-gray-200 rounded-md"
                      />
                      <div className="text-sm text-gray-500 mt-1">
                        {customEndDate ? format(customEndDate, "EEEE d MMMM yyyy", { locale: it }) : "Seleziona una data"}
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2 border-t p-4">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowDatePicker(false);
                      setCustomStartDate(null);
                      setCustomEndDate(null);
                    }}
                  >
                    Annulla
                  </Button>
                  <Button 
                    onClick={handleDateConfirm}
                    disabled={!customStartDate || !customEndDate}
                  >
                    Conferma e Crea
                  </Button>
                </CardFooter>
              </Card>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                <div className="text-center">
                  <span className="material-icons text-gray-400 text-5xl mb-4">event_busy</span>
                  <h3 className="text-lg font-medium mb-2">
                    Nessuna pianificazione per la settimana {dateRangeText}
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Crea una nuova pianificazione per iniziare a gestire i turni.
                  </p>
                  <Button onClick={handleCreateSchedule} disabled={createScheduleMutation.isPending}>
                    {createScheduleMutation.isPending ? (
                      <>
                        <span className="material-icons animate-spin mr-2">sync</span>
                        Creazione in corso...
                      </>
                    ) : (
                      <>
                        <span className="material-icons mr-2">add</span>
                        Crea Pianificazione
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Visualizzazione email di notifica */}
      {showEmailPreview && bulkEmailsData.length > 0 && (
        <BulkEmailPreview
          open={showEmailPreview}
          onClose={() => {
            setShowEmailPreview(false);
            // Dopo la chiusura, pubblica il programma
            if (existingSchedule?.id) {
              publishScheduleMutation.mutate(existingSchedule.id);
            }
          }}
          emailsData={bulkEmailsData}
        />
      )}
      
      {/* Dialog per la generazione automatica */}
      <Dialog open={showAutoGenerator} onOpenChange={setShowAutoGenerator}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generazione automatica turni</DialogTitle>
          </DialogHeader>
          <ScheduleAutoGenerator 
            onScheduleGenerated={handleScheduleGenerated}
          />
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
