import { useState, useEffect } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generateTimeSlots, calculateWorkHours, formatHours } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * La griglia Excel-like per la gestione dei turni
 * Implementa esattamente la funzionalità richiesta con:
 * - Celle con cadenza di 30 minuti dalle 4:00 alle 24:00
 * - Visualizzazione per singolo giorno con tab per ogni giorno della settimana
 * - X per indicare presenza lavorativa
 * - F per indicare ferie
 * - P per indicare permessi
 * - Colonna NOTE per annotazioni
 * - Colonna TOTALE per calcolo automatico delle ore
 */

type ScheduleGridProps = {
  scheduleId: number | null;
  users: any[];
  startDate: Date;
  endDate: Date;
  shifts: any[];
  timeOffRequests: any[];
  isPublished: boolean;
  onPublish: () => void;
  forceResetGrid?: boolean; // Forza un reset completo della griglia
};

export function ExcelGrid({
  scheduleId,
  users,
  startDate,
  endDate,
  shifts,
  timeOffRequests,
  isPublished,
  onPublish,
  forceResetGrid = false
}: ScheduleGridProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDay, setSelectedDay] = useState(0);
  
  // Generazione degli slot di tempo (30 minuti) dalle 4:00 alle 24:00
  const timeSlots = generateTimeSlots(4, 24);
  
  // Inizializza giorni della settimana
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    return {
      date,
      name: format(date, "EEEE", { locale: it }),
      shortName: format(date, "EEE", { locale: it }),
      formattedDate: format(date, "yyyy-MM-dd")
    };
  });
  
  // State per la griglia dei dati
  const [gridData, setGridData] = useState<Record<string, Record<number, {
    cells: Array<{ type: string; shiftId: number | null; isTimeOff?: boolean }>;
    notes: string;
    total: number;
  }>>>({});
  
  // MUTATION MIGLIORATA per il salvataggio dei turni
  const updateShiftMutation = useMutation({
    mutationFn: async (data: any) => {
      let response;
      
      if (data.id) {
        // Aggiorna un turno esistente
        response = await apiRequest("PATCH", `/api/shifts/${data.id}`, data);
      } else {
        // Crea un nuovo turno
        response = await apiRequest("POST", `/api/shifts`, { 
          ...data, 
          scheduleId 
        });
      }
      
      // Converti la risposta in un oggetto JSON e restituiscilo
      // In questo modo non avremo problemi di tipo con onSuccess
      return await response.json();
    },
    onSuccess: (data) => {
      // Invalida la query per aggiornare i dati
      queryClient.invalidateQueries({ queryKey: [`/api/schedules/${scheduleId}/shifts`] });
      
      // Notifica l'utente
      toast({
        title: "Turno aggiornato",
        description: "Il turno è stato aggiornato con successo.",
      });
    },
    onError: (error: any) => {
      // Notifica l'errore
      toast({
        title: "Errore aggiornamento",
        description: `Si è verificato un errore: ${error.message || 'Errore sconosciuto'}`,
        variant: "destructive",
      });
      
      // Log dettagliato dell'errore
      console.error('❌ Errore durante l\'aggiornamento del turno:', error);
    }
  });
  
  // MUTATION MIGLIORATA per l'eliminazione dei turni
  const deleteShiftMutation = useMutation({
    mutationFn: async (id: number) => {
      // Chiamata API migliorata con gestione errori
      const response = await apiRequest("DELETE", `/api/shifts/${id}`, {});
      
      // Per compatibilità con le altre funzioni
      try {
        return await response.json();
      } catch (e) {
        // DELETE potrebbe non restituire JSON, in tal caso restituiamo un oggetto vuoto
        return { success: true };
      }
    },
    onSuccess: () => {
      // Invalida la query per aggiornare i dati
      queryClient.invalidateQueries({ queryKey: [`/api/schedules/${scheduleId}/shifts`] });
      
      // Notifica molto breve per non essere intrusiva durante l'eliminazione
      toast({
        title: "Turno eliminato",
        description: "Il turno è stato eliminato con successo.",
        duration: 1500, // Toast più breve
      });
    },
    onError: (error: any) => {
      // Notifica l'errore
      toast({
        title: "Errore eliminazione",
        description: `Si è verificato un errore: ${error.message || 'Errore sconosciuto'}`,
        variant: "destructive",
      });
      
      // Log dettagliato dell'errore
      console.error('❌ Errore durante l\'eliminazione del turno:', error);
    }
  });
  
  // INIZIALIZZAZIONE MIGLIORATA DELLA GRIGLIA
  useEffect(() => {
    // Verifica che ci siano utenti disponibili
    if (!users.length) return;
    
    // Controlla i parametri URL per vedere se dobbiamo forzare un reset
    const urlParams = new URLSearchParams(window.location.search);
    const forceEmptyFromUrl = urlParams.get('forceEmpty') === 'true';
    const scheduleIdFromUrl = urlParams.get('scheduleId');
    const resetFromUrl = urlParams.get('reset') === 'true';
    const newScheduleParam = urlParams.get('newSchedule');
    
    // Condizioni per il reset completo della griglia (VERSIONE MIGLIORATA)
    // Inclusi più casi per garantire sempre un reset quando necessario
    const shouldReset = 
      forceResetGrid || 
      forceEmptyFromUrl || 
      resetFromUrl || 
      Object.keys(gridData).length === 0 ||
      (scheduleIdFromUrl && scheduleId?.toString() === scheduleIdFromUrl) ||
      (newScheduleParam && scheduleId?.toString() === newScheduleParam);
    
    if (shouldReset) {
      // Log dettagliato delle condizioni di reset
      console.log("RESET COMPLETO GRIGLIA:", {
        forceResetGrid,
        forceEmptyFromUrl, 
        resetFromUrl, 
        scheduleIdFromUrl,
        newScheduleParam,
        currentScheduleId: scheduleId,
        timestamp: Date.now()
      });
      
      // FASE 1: INIZIALIZZAZIONE DI UNA GRIGLIA COMPLETAMENTE VUOTA
      const newGridData: Record<string, Record<number, {
        cells: Array<{ type: string; shiftId: number | null; isTimeOff?: boolean }>;
        notes: string;
        total: number;
      }>> = {};
      
      // FASE 2: PREPARAZIONE STRUTTURA VUOTA
      // Inizializza tutti i giorni con una struttura completamente vuota
      weekDays.forEach(day => {
        newGridData[day.name] = {};
        
        // Filtra solo i dipendenti attivi (evita di creare celle per utenti non attivi)
        // In questa versione migliorata, filtra più rigorosamente
        const activeUsers = users.filter(u => 
          u.role === "employee" && 
          u.isActive === true && 
          u.id !== undefined
        );
        
        // Per ogni utente attivo, crea una struttura vuota per questo giorno
        activeUsers.forEach(user => {
          // Crea celle completamente vuote inizializzate correttamente
          newGridData[day.name][user.id] = {
            cells: timeSlots.map(() => ({ 
              type: "", 
              shiftId: null,
              isTimeOff: false // Aggiungiamo esplicitamente isTimeOff = false per chiarezza
            })),
            notes: "",
            total: 0
          };
        });
      });
      
      console.log("✅ Pulizia completa della tabella dei turni completata. Griglia reimpostata vuota.");
      
      // Popola la griglia con i turni esistenti
      if (shifts && shifts.length > 0 && scheduleId) {
        shifts.forEach(shift => {
          const userId = shift.userId;
          const day = shift.day;
          
          if (newGridData[day] && newGridData[day][userId]) {
            // Trova gli indici corrispondenti all'intervallo di tempo del turno
            const startIndex = timeSlots.indexOf(shift.startTime);
            const endIndex = timeSlots.indexOf(shift.endTime);
            
            if (startIndex >= 0 && endIndex >= 0) {
              // Imposta tutte le celle nell'intervallo
              for (let i = startIndex; i < endIndex; i++) {
                newGridData[day][userId].cells[i] = { 
                  type: shift.type, 
                  shiftId: shift.id,
                  isTimeOff: false // Per default, i turni normali non sono richieste di ferie/permessi
                };
              }
              
              // Aggiorna le note
              newGridData[day][userId].notes = shift.notes || "";
              
              // Aggiorna il conteggio delle ore (solo per il tipo "work")
              if (shift.type === "work") {
                try {
                  // Calcola la durata in ore (ad es. 4.5 per 4 ore e 30 minuti)
                  const hours = calculateWorkHours(shift.startTime, shift.endTime);
                  // Aggiorna il totale delle ore dell'utente per questo giorno
                  newGridData[day][userId].total += hours;
                } catch (e) {
                  console.error(`Errore nel calcolo delle ore per il turno ID ${shift.id}:`, e);
                }
              }
            }
          }
        });
      }
      
      // FASE 3: APPLICAZIONE RICHIESTE FERIE/PERMESSI
      // Applica richieste di ferie/permessi APPROVATE sopra i turni esistenti
      if (timeOffRequests && timeOffRequests.length > 0) {
        console.log(`📋 Applicazione di ${timeOffRequests.length} richieste di ferie/permessi approvate`);
        
        // Filtra solo le richieste approvate
        const approvedRequests = timeOffRequests.filter(req => req.status === "approved");
        
        // Per ogni richiesta di ferie/permessi approvata
        approvedRequests.forEach(request => {
          const userId = request.userId;
          const requestType = request.type === "vacation" ? "vacation" : "leave";
          
          // Controlla l'intervallo di date
          const startDate = new Date(request.startDate);
          const endDate = new Date(request.endDate);
          
          // Applica la richiesta a tutti i giorni interessati
          weekDays.forEach(day => {
            const dayDate = day.date;
            
            // Se il giorno corrente è nell'intervallo della richiesta
            const isSameOrAfterStart = dayDate >= startDate;
            const isSameOrBeforeEnd = dayDate <= endDate;
            
            if (isSameOrAfterStart && isSameOrBeforeEnd && newGridData[day.name] && newGridData[day.name][userId]) {
              // Determina se è mezza giornata (mattina/pomeriggio) o giornata intera
              if (request.halfDay) {
                // Gestione dei permessi a mezza giornata
                // Mattina (fino alle 13:00)
                if (request.halfDayPeriod === "morning") {
                  for (let i = 0; i < timeSlots.length; i++) {
                    const hour = parseInt(timeSlots[i].split(':')[0]);
                    if (hour < 13) {
                      newGridData[day.name][userId].cells[i] = {
                        type: requestType,
                        shiftId: null,
                        isTimeOff: true // Flag esplicito per identificare le celle di ferie/permessi
                      };
                    }
                  }
                  // Aggiorna le note con dettagli più chiari
                  newGridData[day.name][userId].notes = `${halfDayText} mattina (${format(startDate, "dd/MM")}-${format(endDate, "dd/MM")})`;
                }
                // Pomeriggio (dalle 13:00)
                else {
                  for (let i = 0; i < timeSlots.length; i++) {
                    const hour = parseInt(timeSlots[i].split(':')[0]);
                    if (hour >= 13) {
                      newGridData[day.name][userId].cells[i] = {
                        type: requestType,
                        shiftId: null,
                        isTimeOff: true
                      };
                    }
                  }
                  // Aggiorna le note con dettagli più chiari 
                  newGridData[day.name][userId].notes = `${halfDayText} pomeriggio (${format(startDate, "dd/MM")}-${format(endDate, "dd/MM")})`;
                }
              }
              // Gestione dei permessi a giornata intera
              else {
                // Marca tutte le celle del giorno come ferie/permessi
                for (let i = 0; i < timeSlots.length; i++) {
                  newGridData[day.name][userId].cells[i] = {
                    type: requestType,
                    shiftId: null,
                    isTimeOff: true
                  };
                }
                
                // Aggiorna le note
                const fullDayText = request.type === "vacation" ? "Ferie" : "Permesso";
                newGridData[day.name][userId].notes = `${fullDayText} giornata intera (${format(startDate, "dd/MM")}-${format(endDate, "dd/MM")})`;
              }
            }
          });
        });
      }
      
      // FASE 4: AGGIORNAMENTO STATO CON LA NUOVA GRIGLIA
      setGridData(newGridData);
      
      // FASE 5: LOG DI COMPLETAMENTO
      console.log(`✅ Inizializzazione completa della griglia turni per schedule ID ${scheduleId}`);
    }
  }, [scheduleId, users, shifts, timeOffRequests, weekDays, timeSlots, forceResetGrid]);
  
  // GESTIONE CLIC MIGLIORATA
  // Gestisce in modo più robusto il clic su una cella della griglia
  const handleCellClick = (userId: number, timeIndex: number, day: string) => {
    // VALIDAZIONE PRELIMINARE
    // Non procedere se non c'è uno schedule valido o se è già pubblicato
    if (!scheduleId || isPublished) {
      if (isPublished) {
        toast({
          title: "Turno pubblicato",
          description: "Non puoi modificare un turno già pubblicato.",
          variant: "destructive"
        });
      }
      return;
    }
    
    // PREPARAZIONE STATO
    // Creiamo una copia profonda dei dati per evitare modifiche accidentali dello stato
    const newGridData = structuredClone(gridData);
    // Verifica che i dati utente/giorno esistano
    if (!newGridData[day] || !newGridData[day][userId]) {
      console.error(`Dati mancanti per utente ${userId} nel giorno ${day}`);
      return;
    }
    
    const userDayData = newGridData[day][userId];
    const currentCell = userDayData.cells[timeIndex];
    
    // CICLO DELLE TIPOLOGIE
    // Determina il nuovo tipo di turno secondo la rotazione stabilita
    let newType = "work"; // Default: se la cella è vuota, diventa lavoro
    
    // Verifica se la cella è bloccata perché è una richiesta di ferie/permesso già approvata
    if (currentCell.isTimeOff) {
      console.log("⚠️ Non è possibile modificare questa cella: è una richiesta di ferie o permesso approvata");
      toast({
        title: "Azione non permessa",
        description: "Non puoi modificare una cella che rappresenta ferie o permessi già approvati.",
        variant: "destructive"
      });
      return;
    }
    
    if (currentCell.type) {
      // Rotazione: work -> vacation -> leave -> (vuoto) -> work...
      if (currentCell.type === "work") {
        newType = "vacation";  // Lavoro -> Ferie
      } else if (currentCell.type === "vacation") {
        newType = "leave";     // Ferie -> Permesso 
      } else if (currentCell.type === "leave") {
        newType = "";          // Permesso -> Vuoto
      }
    }
    
    console.log(`🔄 Cambio tipo cella: ${currentCell.type || 'vuota'} -> ${newType || 'vuota'}`);
    
    // GESTIONE API PER TIPO DI AZIONE
    // 1. SE LA CELLA HA UN ID ESISTENTE
    if (currentCell.shiftId) {
      if (newType === "") {
        // CASO 1: ELIMINAZIONE
        // Elimina il turno dal database
        deleteShiftMutation.mutate(currentCell.shiftId);
        
        // Aggiorna il conteggio delle ore (solo se era un turno di lavoro)
        if (currentCell.type === "work") {
          const slotDuration = 0.5; // 30 minuti
          userDayData.total = Math.max(0, userDayData.total - slotDuration);
        }
        
        // Aggiorna la cella localmente
        userDayData.cells[timeIndex] = { 
          type: "", 
          shiftId: null,
          isTimeOff: false
        };
      } else {
        // CASO 2: AGGIORNAMENTO
        // Prepara i dati per l'aggiornamento
        const updateData = {
          id: currentCell.shiftId,
          scheduleId,
          userId,
          day,
          startTime: timeSlots[timeIndex],
          endTime: timeSlots[timeIndex + 1],
          type: newType,
          notes: userDayData.notes || ""
        };
        
        // Invia l'aggiornamento al server
        updateShiftMutation.mutate(updateData);
        
        // Aggiorna il conteggio delle ore
        if (currentCell.type === "work" && newType !== "work") {
          // Se passiamo da lavoro a non-lavoro, sottraiamo ore
          const slotDuration = 0.5;
          userDayData.total = Math.max(0, userDayData.total - slotDuration);
        } else if (currentCell.type !== "work" && newType === "work") {
          // Se passiamo da non-lavoro a lavoro, aggiungiamo ore
          const slotDuration = 0.5;
          userDayData.total += slotDuration;
        }
        
        // Aggiorna lo stato della cella
        userDayData.cells[timeIndex] = { 
          type: newType, 
          shiftId: currentCell.shiftId,
          isTimeOff: false // Imposta esplicitamente a false quando viene modificato manualmente
        };
      }
    } 
    // 2. CELLA SENZA ID O VUOTA CHE DIVENTA NON-VUOTA
    else if (newType !== "") {
      // CASO 3: CREAZIONE
      // Prepara i dati per la creazione
      const createData = {
        scheduleId,
        userId,
        day,
        startTime: timeSlots[timeIndex],
        endTime: timeSlots[timeIndex + 1],
        type: newType,
        notes: userDayData.notes || "",
        area: null // Area opzionale
      };
      
      // Crea un nuovo turno nel database
      updateShiftMutation.mutate(createData, {
        onSuccess: (data) => {
          // Ora la risposta è già un oggetto JSON grazie alla mutationFn migliorata
          // che converte automaticamente la risposta in JSON
            
          // Se la risposta contiene un ID, aggiorniamo la cella con l'ID corretto
          if (data && data.id) {
            const updatedGridData = structuredClone(gridData);
            if (updatedGridData[day] && updatedGridData[day][userId]) {
              updatedGridData[day][userId].cells[timeIndex].shiftId = data.id;
              setGridData(updatedGridData);
              console.log(`✅ Cella aggiornata con nuovo ID turno: ${data.id}`);
            }
          }
        }
      });
      
      // Aggiorna il conteggio delle ore (solo per tipo "work")
      if (newType === "work") {
        const slotDuration = 0.5;
        userDayData.total += slotDuration;
      }
      
      // Aggiorna lo stato della cella
      userDayData.cells[timeIndex] = { 
        type: newType, 
        shiftId: null, // Verrà aggiornato nella callback di successo
        isTimeOff: false
      };
    }
    
    // AGGIORNAMENTO STATO FINALE
    setGridData(newGridData);
  };
  
  // GESTIONE NOTE MIGLIORATA
  // Gestisce in modo più robusto le note di un turno
  const handleNotesChange = (userId: number, day: string, value: string) => {
    // Validazione - non modifica se è pubblicato
    if (isPublished) return;
    
    // Aggiorna lo stato locale
    const newGridData = structuredClone(gridData);
    if (newGridData[day] && newGridData[day][userId]) {
      newGridData[day][userId].notes = value;
    }
    
    // AGGIORNAMENTO STATO LOCALE
    // Applica immediatamente il cambiamento all'interfaccia
    setGridData(newGridData);
    
    // AGGIORNAMENTO DATABASE
    // Trova tutti i turni associati all'utente per questo giorno
    const userDayShifts = shifts.filter(
      (shift: any) => shift.userId === userId && 
                      shift.day === day && 
                      shift.id !== undefined
    );
    
    // Log per debug
    console.log(`📝 Aggiornamento note per ${userDayShifts.length} turni di ${day}:`, value);
    
    // Se non ci sono turni ma c'è una nota, crea un turno "note-only" come promemoria
    if (userDayShifts.length === 0 && value.trim() !== '') {
      // Cerca la prima cella vuota nel giorno
      const firstEmptySlotIndex = newGridData[day][userId].cells.findIndex(cell => 
        !cell.type && !cell.shiftId
      );
      
      // Se troviamo una cella vuota, creiamo un turno placeholder
      if (firstEmptySlotIndex >= 0) {
        console.log(`🆕 Creazione turno placeholder per le note del giorno ${day}`);
        
        // Crea un nuovo turno nel database
        updateShiftMutation.mutate({
          scheduleId,
          userId,
          day,
          startTime: timeSlots[firstEmptySlotIndex],
          endTime: timeSlots[firstEmptySlotIndex + 1],
          type: "note", // Tipo speciale per i turni che esistono solo per le note
          notes: value,
          area: null
        }, {
          onSuccess: (data) => {
            // Aggiorna la UI con l'ID del nuovo turno
            if (data && data.id) {
              const updatedGridData = structuredClone(gridData);
              updatedGridData[day][userId].cells[firstEmptySlotIndex].shiftId = data.id;
              updatedGridData[day][userId].cells[firstEmptySlotIndex].type = "note";
              setGridData(updatedGridData);
              
              toast({
                title: "Note salvate",
                description: "Le note sono state salvate correttamente.",
                duration: 1500,
              });
            }
          }
        });
      }
    }
    // Se ci sono turni esistenti, aggiorna le note per ciascuno
    else if (userDayShifts.length > 0) {
      // Aggiorna tutti i turni dell'utente per quel giorno
      userDayShifts.forEach((shift: any) => {
        // Trova l'indice della cella corrispondente
        const startIndex = timeSlots.indexOf(shift.startTime);
        
        if (startIndex >= 0 && shift.id) {
          // Aggiorna solo il turno nel database
          updateShiftMutation.mutate({
            id: shift.id,
            scheduleId: shift.scheduleId,
            userId: shift.userId,
            day: shift.day,
            startTime: shift.startTime,
            endTime: shift.endTime,
            type: shift.type,
            notes: value,
            area: shift.area
          }, {
            onSuccess: () => {
              toast({
                title: "Note aggiornate",
                description: "Le note sono state aggiornate correttamente.",
                duration: 1500,
              });
            }
          });
          
          // Termina dopo aver aggiornato il primo turno
          // Gli altri turni nello stesso giorno dovrebbero avere le stesse note
          return false;
        }
      });
    }
  };
  
  // Funzione per pubblicare lo schedule
  const handlePublish = () => {
    if (!scheduleId) return;
    
    // Mostra un toast di conferma
    toast({
      title: "Pubblicazione in corso...",
      description: "Il turno sta per essere pubblicato e notificato agli utenti.",
    });
    
    // Esegui il callback
    onPublish();
  };
  
  return (
    <div className="schedule-grid bg-white rounded-md shadow-sm">
      <div className="p-4 border-b">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 className="text-xl font-bold mb-1">Pianificazione Turni</h2>
            <p className="text-sm text-muted-foreground">
              {format(startDate, "dd MMMM", { locale: it })} - {format(endDate, "dd MMMM yyyy", { locale: it })}
            </p>
          </div>
          
          <div className="flex space-x-2">
            {!isPublished && (
              <Button onClick={handlePublish} className="bg-green-600 hover:bg-green-700 text-white">
                <span className="material-icons text-sm mr-1">publish</span>
                Pubblica turni
              </Button>
            )}
            {isPublished && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <span className="material-icons text-sm mr-1">check_circle</span>
                      Pubblicato
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm">Questo piano è già stato pubblicato</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>
      
      <div className="p-4">
        <Tabs defaultValue={weekDays[selectedDay].name} onValueChange={(value) => {
          const dayIndex = weekDays.findIndex(d => d.name === value);
          if (dayIndex !== -1) {
            setSelectedDay(dayIndex);
          }
        }}>
          <TabsList className="mb-4 w-full">
            {weekDays.map((day, idx) => (
              <TabsTrigger key={day.name} value={day.name} className="flex-1">
                <span className="hidden sm:inline">{day.name}</span>
                <span className="sm:hidden">{day.shortName}</span>
                <span className="ml-1 text-xs text-muted-foreground hidden sm:inline">
                  {format(day.date, "d/M")}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          
          {weekDays.map((day) => (
            <TabsContent key={day.name} value={day.name} className="relative">
              <div className="overflow-auto border rounded-md">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-1 sm:p-2 text-left font-medium">Dipendente</th>
                      {timeSlots.map((slot, idx) => (
                        idx < timeSlots.length - 1 && (
                          <th key={idx} className="p-1 sm:p-2 text-center text-xs sm:text-sm font-medium">
                            {slot}
                          </th>
                        )
                      ))}
                      <th className="p-2 text-left font-medium">Note</th>
                      <th className="p-2 text-center font-medium">Totale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users
                      .filter(user => user.role === "employee" && user.isActive)
                      .map((user) => (
                        <tr key={user.id} className="border-b hover:bg-muted/20">
                          <td className="p-2 text-left font-medium text-xs sm:text-sm">
                            {user.fullName || user.username}
                          </td>
                          
                          {timeSlots.map((slot, idx) => {
                            if (idx >= timeSlots.length - 1) return null;
                            
                            // Get cell data
                            const cellData = gridData[day.name]?.[user.id]?.cells[idx] || { type: "", shiftId: null };
                            const cellType = cellData.type;
                            
                            // Style based on cell type
                            let cellStyle = "cursor-pointer hover:bg-gray-50 transition-colors";
                            let cellContent = "";
                            
                            if (cellType === "work") {
                              cellStyle += " bg-blue-50 text-blue-700";
                              cellContent = "X";
                            } else if (cellType === "vacation") {
                              cellStyle += " bg-red-50 text-red-700";
                              cellContent = "F";
                            } else if (cellType === "leave") {
                              cellStyle += " bg-yellow-50 text-yellow-700";
                              cellContent = "P";
                            }
                            
                            return (
                              <td 
                                key={idx}
                                className={`p-0 text-center ${cellStyle}`}
                                onClick={() => handleCellClick(user.id, idx, day.name)}
                              >
                                <div className="w-full h-full p-0 sm:p-1 text-xs sm:text-sm">
                                  {cellContent}
                                </div>
                              </td>
                            );
                          })}
                          
                          <td className="p-1">
                            <Input
                              size={20}
                              placeholder="Note..."
                              value={gridData[day.name]?.[user.id]?.notes || ""}
                              onChange={(e) => handleNotesChange(user.id, day.name, e.target.value)}
                              disabled={isPublished}
                              className="text-xs sm:text-sm w-full"
                            />
                          </td>
                          
                          <td className="p-1 sm:p-2 text-center font-semibold text-xs sm:text-sm">
                            {formatHours(gridData[day.name]?.[user.id]?.total || 0)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-4 text-xs text-muted-foreground">
                <div className="flex flex-wrap gap-2 sm:gap-4">
                  <div className="flex items-center">
                    <span className="inline-block w-3 h-3 rounded-full bg-blue-100 border border-blue-300 mr-1"></span>
                    <span>X = In servizio</span>
                  </div>
                  <div className="flex items-center">
                    <span className="inline-block w-3 h-3 rounded-full bg-red-100 border border-red-300 mr-1"></span>
                    <span>F = Ferie</span>
                  </div>
                  <div className="flex items-center">
                    <span className="inline-block w-3 h-3 rounded-full bg-yellow-100 border border-yellow-300 mr-1"></span>
                    <span>P = Permesso</span>
                  </div>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}