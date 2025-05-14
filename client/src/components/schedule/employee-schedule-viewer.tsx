import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, parseISO, addDays } from "date-fns";
import { it } from "date-fns/locale";
import { formatHours, calculateTotalWorkHours, calculateWorkHours } from "@/lib/utils";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * Corregge l'orario di fine turno per la visualizzazione
 * Rimuove 30 minuti dall'orario di fine per compensare l'offset introdotto dal sistema di celle
 */
function adjustEndTime(endTime: string): string {
  try {
    const [hours, minutes] = endTime.split(':').map(Number);
    
    // Se il formato non è corretto, restituisci l'orario originale
    if (isNaN(hours) || isNaN(minutes)) {
      return endTime;
    }
    
    // Sottraiamo 30 minuti
    let newMinutes = minutes - 30;
    let newHours = hours;
    
    // Gestione del riporto negativo
    if (newMinutes < 0) {
      newMinutes += 60;
      newHours -= 1;
    }
    
    // Gestione passaggio dalla mezzanotte
    if (newHours < 0) {
      newHours += 24;
    }
    
    // Formattazione con zero padding
    return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
  } catch (e) {
    // In caso di errore, restituisci l'orario originale
    console.error('Errore nella correzione orario:', e);
    return endTime;
  }
}

type EmployeeScheduleViewerProps = {
  schedule: any;
  shifts: any[];
  userShifts: any[];
};

/**
 * Visualizzatore dei turni per i dipendenti
 * Mostra i propri turni pubblicati in formato tabella
 */
export function EmployeeScheduleViewer({ schedule, shifts, userShifts }: EmployeeScheduleViewerProps) {
  const [view, setView] = useState<"week" | "list">("week");
  const [isExporting, setIsExporting] = useState(false);
  
  // Funzione per esportare il programma in PDF
  const handleExportPDF = async () => {
    if (!schedule) return;
    
    try {
      setIsExporting(true);
      
      // Seleziona l'elemento HTML da convertire in PDF
      const element = document.getElementById('scheduleContent');
      if (!element) {
        console.error('Elemento scheduleContent non trovato');
        setIsExporting(false);
        return;
      }
      
      // Crea una copia dello stile per l'esportazione
      const originalTransform = element.style.transform;
      const originalZIndex = element.style.zIndex;
      const originalPosition = element.style.position;
      
      // Modifica temporaneamente lo stile per l'esportazione
      element.style.transform = 'none';
      element.style.zIndex = '9999';
      element.style.position = 'relative';
      
      // Usa html2canvas per catturare lo schermo
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false
      });
      
      // Ripristina lo stile originale
      element.style.transform = originalTransform;
      element.style.zIndex = originalZIndex;
      element.style.position = originalPosition;
      
      // Crea un nuovo documento PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Aggiungi l'immagine al PDF
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      
      // Genera il nome del file con il periodo
      const fromDate = format(new Date(schedule.startDate), 'dd-MM-yyyy', { locale: it });
      const toDate = format(new Date(schedule.endDate), 'dd-MM-yyyy', { locale: it });
      const fileName = `turni-${fromDate}-${toDate}.pdf`;
      
      // Scarica il PDF
      pdf.save(fileName);
    } catch (error) {
      console.error('Errore durante l\'esportazione PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };
  
  if (!schedule) {
    return (
      <Card className="bg-white shadow-sm">
        <CardContent className="p-6">
          <div className="text-center py-8">
            <span className="material-icons text-gray-400 text-5xl mb-4">event_busy</span>
            <h3 className="text-lg font-medium mb-2">Nessun turno disponibile</h3>
            <p className="text-gray-500">
              Non ci sono turni pubblicati al momento. Controlla più tardi.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Data inizio e fine settimana
  const startDate = new Date(schedule.startDate);
  const endDate = new Date(schedule.endDate);
  
  // Genera i giorni della settimana
  const weekDays = [];
  let currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    weekDays.push({
      date: new Date(currentDate),
      name: format(currentDate, "EEEE", { locale: it }),
      shortName: format(currentDate, "EEE", { locale: it }),
      formattedDate: format(currentDate, "d/M", { locale: it }),
    });
    currentDate = addDays(currentDate, 1);
  }
  
  // Organizza gli orari per giorno
  const shiftsByDay: Record<string, any[]> = {};
  
  userShifts.forEach(shift => {
    if (!shiftsByDay[shift.day]) {
      shiftsByDay[shift.day] = [];
    }
    shiftsByDay[shift.day].push(shift);
  });
  
  return (
    <Card className="bg-white shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row items-center justify-between gap-2 pb-2 pt-4 sm:pt-6">
        <CardTitle className="text-base sm:text-lg font-medium">I Miei Turni</CardTitle>
        <div className="flex flex-col xs:flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={isExporting || !schedule}
            className="text-xs"
          >
            <span className="material-icons text-xs sm:text-sm mr-1">download</span>
            {isExporting ? "Esportazione..." : "Scarica PDF"}
          </Button>
          <div className="flex bg-gray-100 rounded-md p-0.5">
            <Button
              variant={view === "week" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("week")}
              className="text-xs"
            >
              <span className="material-icons text-xs sm:text-sm mr-1">view_week</span>
              <span className="hidden xs:inline">Settimana</span>
              <span className="xs:hidden">Sett.</span>
            </Button>
            <Button
              variant={view === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("list")}
              className="text-xs"
            >
              <span className="material-icons text-xs sm:text-sm mr-1">list</span>
              Lista
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {/* Dettagli pianificazione */}
      <div className="px-4 sm:px-6 pb-2 pt-0">
        <p className="text-xs sm:text-sm text-gray-500 mb-4 text-center sm:text-left">
          <span className="material-icons text-xs align-middle mr-1">calendar_today</span>
          {format(startDate, "d MMM", { locale: it })} - {format(endDate, "d MMM yyyy", { locale: it })}
        </p>
      </div>
      
      <CardContent className="pb-6 pt-0" id="scheduleContent">
        {/* Visualizzazione a settimana */}
        {view === "week" && (
          <>
            {/* Visualizzazione Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    {weekDays.map(day => (
                      <th 
                        key={day.formattedDate}
                        className="border px-3 py-2 text-center font-medium"
                      >
                        <div className="whitespace-nowrap text-sm">{day.shortName}</div>
                        <div className="text-xs font-normal text-gray-500">{day.formattedDate}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {weekDays.map(day => {
                      const dayShifts = shiftsByDay[day.name] || [];
                      
                      // Ordina i turni per orario di inizio
                      dayShifts.sort((a, b) => a.startTime.localeCompare(b.startTime));
                      
                      return (
                        <td key={day.formattedDate} className="border p-3 align-top h-28">
                          {dayShifts.length === 0 ? (
                            <div className="text-center py-2 text-gray-400 text-sm">
                              Non in servizio
                            </div>
                          ) : (
                            <div>
                              {/* Prima raggruppiamo i turni per tipo */}
                              {(() => {
                                // Dobbiamo rimuovere i duplicati e dare priorità ai tipi di assenza
                                // Prima organizziamo i turni per slot orario
                                const timeSlotMap = new Map();
                                
                                // Ordine di priorità: sick > leave > vacation > work
                                // Aggiungiamo ogni turno, rimpiazzando quelli a priorità inferiore
                                dayShifts.forEach(shift => {
                                  const timeKey = `${shift.startTime}-${shift.endTime}`;
                                  
                                  if (!timeSlotMap.has(timeKey)) {
                                    // Se non esiste ancora questo slot, aggiungiamo
                                    timeSlotMap.set(timeKey, shift);
                                  } else {
                                    // Se esiste già, controlliamo la priorità
                                    const existingShift = timeSlotMap.get(timeKey);
                                    const existingPriority = getPriorityValue(existingShift.type);
                                    const newPriority = getPriorityValue(shift.type);
                                    
                                    // Sostituisci solo se la nuova priorità è maggiore
                                    if (newPriority > existingPriority) {
                                      timeSlotMap.set(timeKey, shift);
                                    }
                                  }
                                });
                                
                                // Prendi i turni senza duplicati dal Map
                                const uniqueShifts = Array.from(timeSlotMap.values());
                                
                                // Ora filtra per tipo
                                const workShifts = uniqueShifts.filter(s => s.type === "work");
                                const vacationShifts = uniqueShifts.filter(s => s.type === "vacation");
                                const leaveShifts = uniqueShifts.filter(s => s.type === "leave");
                                const sickShifts = uniqueShifts.filter(s => s.type === "sick");
                                
                                // Consolida gli intervalli di lavoro consecutivi
                                const consolidatedWorkShifts: any[] = [];
                                let currentShift: any = null;
                                
                                // Ordina per orario di inizio
                                workShifts.sort((a, b) => a.startTime.localeCompare(b.startTime));
                                
                                workShifts.forEach((shift) => {
                                  if (!currentShift) {
                                    // Primo turno da considerare
                                    currentShift = { ...shift };
                                  } else {
                                    // Controlla se questo turno è consecutivo all'ultimo
                                    if (shift.startTime === currentShift.endTime) {
                                      // Estendi il turno corrente
                                      currentShift.endTime = shift.endTime;
                                    } else {
                                      // Questo turno non è consecutivo, salva quello corrente e inizia uno nuovo
                                      consolidatedWorkShifts.push(currentShift);
                                      currentShift = { ...shift };
                                    }
                                  }
                                });
                                
                                // Aggiungi l'ultimo turno se esiste
                                if (currentShift) {
                                  consolidatedWorkShifts.push(currentShift);
                                }
                                
                                // Funzione helper per determinare la priorità del tipo di turno
                                function getPriorityValue(type: string): number {
                                  switch (type) {
                                    case "sick": return 4;
                                    case "leave": return 3;
                                    case "vacation": return 2;
                                    case "work": return 1;
                                    default: return 0;
                                  }
                                }
                                
                                // Calcola il totale delle ore di lavoro usando la funzione di utilità centralizzata
                                const totalHours = calculateTotalWorkHours(consolidatedWorkShifts);
                                
                                return (
                                  <>
                                    {/* Mostra totale ore se ci sono turni di lavoro */}
                                    {workShifts.length > 0 && (
                                      <div className="font-medium text-sm mb-2">
                                        Ore: {totalHours.toFixed(1)}h
                                      </div>
                                    )}
                                    
                                    {/* Mostra gli slot di lavoro in modo destacato */}
                                    {consolidatedWorkShifts.length > 0 && (
                                      <div className="bg-white shadow-md rounded-md p-3 mb-2 border-l-4 border-blue-500">
                                        <div className="font-medium text-blue-700 flex items-center mb-3 text-sm">
                                          <span className="material-icons text-sm mr-1">schedule</span>
                                          Orario di lavoro
                                        </div>
                                        <div className="grid grid-cols-1 gap-2">
                                          {consolidatedWorkShifts.map((shift, idx) => (
                                            <div key={idx} className="flex flex-row items-center justify-between bg-blue-50 rounded-md p-3 mb-1">
                                              <div className="flex items-center">
                                                <span className="material-icons text-blue-600 mr-2 text-sm">access_time</span>
                                                <div className="font-medium text-base">{shift.startTime} - {adjustEndTime(shift.endTime)}</div>
                                              </div>
                                              {shift.notes && <div className="ml-3 text-sm text-gray-600 italic">{shift.notes}</div>}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Mostra ferie */}
                                    {vacationShifts.length > 0 && (
                                      <div className="bg-red-100 rounded-md p-3 mb-2">
                                        <div className="font-medium flex items-center text-sm">
                                          <span className="material-icons text-sm mr-1">beach_access</span>
                                          Ferie (F)
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Mostra permessi */}
                                    {leaveShifts.length > 0 && (
                                      <div className="bg-yellow-100 rounded-md p-3 mb-2">
                                        <div className="font-medium flex items-center text-sm">
                                          <span className="material-icons text-sm mr-1">event_busy</span>
                                          Permesso (P)
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Mostra malattia */}
                                    {sickShifts.length > 0 && (
                                      <div className="bg-purple-100 rounded-md p-3 mb-2">
                                        <div className="font-medium flex items-center text-sm">
                                          <span className="material-icons text-sm mr-1">healing</span>
                                          Malattia (M)
                                        </div>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
            
            {/* Visualizzazione Mobile: Layout a carte (card) */}
            <div className="md:hidden space-y-4">
              {weekDays.map(day => {
                const dayShifts = shiftsByDay[day.name] || [];
                dayShifts.sort((a, b) => a.startTime.localeCompare(b.startTime));
                
                return (
                  <div key={day.formattedDate} className="border rounded-md overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 border-b">
                      <div className="flex justify-between items-center">
                        <div className="font-medium">{day.name}</div>
                        <div className="text-xs text-gray-500">{day.formattedDate}</div>
                      </div>
                    </div>
                    
                    <div className="p-3">
                      {dayShifts.length === 0 ? (
                        <div className="text-center py-3 text-gray-400">
                          Non in servizio
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {(() => {
                            // Stessa logica di raggruppamento e consolidamento della visualizzazione desktop
                            const timeSlotMap = new Map();
                            
                            dayShifts.forEach(shift => {
                              const timeKey = `${shift.startTime}-${shift.endTime}`;
                              
                              if (!timeSlotMap.has(timeKey)) {
                                timeSlotMap.set(timeKey, shift);
                              } else {
                                const existingShift = timeSlotMap.get(timeKey);
                                const existingPriority = getPriorityValue(existingShift.type);
                                const newPriority = getPriorityValue(shift.type);
                                
                                if (newPriority > existingPriority) {
                                  timeSlotMap.set(timeKey, shift);
                                }
                              }
                            });
                            
                            const uniqueShifts = Array.from(timeSlotMap.values());
                            
                            const workShifts = uniqueShifts.filter(s => s.type === "work");
                            const vacationShifts = uniqueShifts.filter(s => s.type === "vacation");
                            const leaveShifts = uniqueShifts.filter(s => s.type === "leave");
                            const sickShifts = uniqueShifts.filter(s => s.type === "sick");
                            
                            const consolidatedWorkShifts: any[] = [];
                            let currentShift: any = null;
                            
                            workShifts.sort((a, b) => a.startTime.localeCompare(b.startTime));
                            
                            workShifts.forEach((shift) => {
                              if (!currentShift) {
                                currentShift = { ...shift };
                              } else {
                                if (shift.startTime === currentShift.endTime) {
                                  currentShift.endTime = shift.endTime;
                                } else {
                                  consolidatedWorkShifts.push(currentShift);
                                  currentShift = { ...shift };
                                }
                              }
                            });
                            
                            if (currentShift) {
                              consolidatedWorkShifts.push(currentShift);
                            }
                            
                            function getPriorityValue(type: string): number {
                              switch (type) {
                                case "sick": return 4;
                                case "leave": return 3;
                                case "vacation": return 2;
                                case "work": return 1;
                                default: return 0;
                              }
                            }
                            
                            const totalHours = calculateTotalWorkHours(consolidatedWorkShifts);
                            
                            return (
                              <>
                                {workShifts.length > 0 && (
                                  <div className="font-medium text-sm mb-2">
                                    Ore: {totalHours.toFixed(1)}h
                                  </div>
                                )}
                                
                                {consolidatedWorkShifts.length > 0 && (
                                  <div className="rounded-md border-l-4 border-blue-500 overflow-hidden">
                                    <div className="font-medium bg-blue-50 p-2 text-blue-700 flex items-center text-sm">
                                      <span className="material-icons text-sm mr-2">schedule</span>
                                      Orario di lavoro
                                    </div>
                                    <div className="divide-y">
                                      {consolidatedWorkShifts.map((shift, idx) => (
                                        <div key={idx} className="p-3">
                                          <div className="flex items-center font-medium">
                                            <span className="material-icons text-blue-600 mr-2 text-sm">access_time</span>
                                            {shift.startTime} - {adjustEndTime(shift.endTime)}
                                          </div>
                                          {shift.notes && (
                                            <div className="mt-1 text-sm text-gray-600 italic">
                                              {shift.notes}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {vacationShifts.length > 0 && (
                                  <div className="bg-red-100 rounded-md p-3">
                                    <div className="font-medium flex items-center text-sm">
                                      <span className="material-icons text-sm mr-2">beach_access</span>
                                      Ferie (F)
                                    </div>
                                  </div>
                                )}
                                
                                {leaveShifts.length > 0 && (
                                  <div className="bg-yellow-100 rounded-md p-3">
                                    <div className="font-medium flex items-center text-sm">
                                      <span className="material-icons text-sm mr-2">event_busy</span>
                                      Permesso (P)
                                    </div>
                                  </div>
                                )}
                                
                                {sickShifts.length > 0 && (
                                  <div className="bg-purple-100 rounded-md p-3">
                                    <div className="font-medium flex items-center text-sm">
                                      <span className="material-icons text-sm mr-2">healing</span>
                                      Malattia (M)
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        
        {/* Visualizzazione a lista */}
        {view === "list" && (
          <div className="space-y-3">
            {weekDays.map(day => {
              const dayShifts = shiftsByDay[day.name] || [];
              
              // Ordina i turni per orario di inizio
              dayShifts.sort((a, b) => a.startTime.localeCompare(b.startTime));
              
              return (
                <div key={day.formattedDate} className="border rounded-md overflow-hidden">
                  <div className="bg-gray-50 px-3 sm:px-4 py-2 font-medium text-xs sm:text-sm">
                    {day.name} {day.formattedDate}
                  </div>
                  
                  {dayShifts.length === 0 ? (
                    <div className="p-3 sm:p-4 text-gray-500 text-xs sm:text-sm">
                      Non in servizio oggi
                    </div>
                  ) : (
                    <div className="divide-y">
                      {dayShifts.map((shift, idx) => {
                        // Determina il tipo di turno
                        let bgColor = "bg-blue-50";
                        let icon = "schedule";
                        let label = "In servizio";
                        
                        if (shift.type === "vacation") {
                          bgColor = "bg-red-50";
                          icon = "beach_access";
                          label = "Ferie";
                        } else if (shift.type === "leave") {
                          bgColor = "bg-yellow-50";
                          icon = "event_busy";
                          label = "Permesso";
                        }
                        
                        return (
                          <div 
                            key={idx} 
                            className={`p-3 sm:p-4 ${bgColor}`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium flex items-center mb-1 text-xs sm:text-sm">
                                  <span className="material-icons text-xs sm:text-sm mr-1">{icon}</span>
                                  {label}
                                </div>
                                
                                {shift.type === "work" && (
                                  <>
                                    <div className="text-sm sm:text-base font-medium">{shift.startTime} - {adjustEndTime(shift.endTime)}</div>
                                    {shift.notes && (
                                      <div className="text-xs sm:text-sm mt-1 text-gray-600 italic">{shift.notes}</div>
                                    )}
                                  </>
                                )}
                              </div>
                              
                              {shift.type === "work" && (
                                <div className="text-xs sm:text-sm font-medium">
                                  {formatHours(Number(shift.hours))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}