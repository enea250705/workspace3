import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout/layout";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format, addDays, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { EmployeeScheduleViewer } from "@/components/schedule/employee-schedule-viewer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WeekSelectorDialog } from "@/components/schedule/week-selector-dialog";
import { formatHours, calculateTotalWorkHours } from "@/lib/utils";

export default function MySchedule() {
  const { user } = useAuth();
  const [date, setDate] = useState<Date>(new Date());
  const [showWeekSelector, setShowWeekSelector] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  
  // Calcola date della settimana
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
  
  // Carica tutti i programmi dei turni pubblicati
  const { data: schedules = [] } = useQuery<any[]>({
    queryKey: ["/api/schedules/all"],
  });
  
  // Filtra i programmi pubblicati più recenti
  const publishedSchedules = schedules
    .filter(schedule => schedule.isPublished)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  
  // Trova il programma che contiene la settimana corrente o se non esiste, quello più recente
  // Se l'utente ha selezionato manualmente un programma, usa quello
  const currentSchedule = selectedScheduleId 
    ? publishedSchedules.find(schedule => schedule.id === selectedScheduleId)
    : publishedSchedules.find(
        schedule => 
          new Date(schedule.startDate) <= date && 
          new Date(schedule.endDate) >= date
      ) || publishedSchedules[0];
  
  // Carica i turni dell'utente corrente dal programma attuale
  const { data: userShifts = [] } = useQuery<any[]>({
    queryKey: [`/api/schedules/${currentSchedule?.id}/shifts/user/${user?.id}`],
    enabled: !!currentSchedule?.id && !!user?.id,
  });
  
  // Carica tutti i turni per il programma corrente (può servire per calcoli o visualizzazioni aggiuntive)
  const { data: allShifts = [] } = useQuery<any[]>({
    queryKey: [`/api/schedules/${currentSchedule?.id}/shifts`],
    enabled: !!currentSchedule?.id,
  });
  
  // Gestisce la selezione di un programma specifico
  const handleSelectSchedule = (scheduleId: number) => {
    setSelectedScheduleId(scheduleId);
    setShowWeekSelector(false);
    
    const selectedSchedule = publishedSchedules.find(s => s.id === scheduleId);
    if (selectedSchedule) {
      // Aggiorna la data corrente per visualizzare la settimana giusta
      setDate(new Date(selectedSchedule.startDate));
    }
  };
  
  // Funzione che genera le date per la settimana visualizzata
  const generateWeekDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      dates.push(addDays(weekStart, i));
    }
    return dates;
  };
  
  // Le date della settimana visualizzata
  const weekDates = generateWeekDates();
  
  return (
    <Layout>
      <div className="container mx-auto py-6">
        <h1 className="text-2xl font-bold mb-6">I Miei Turni</h1>
        
        {/* Dialog per selezionare una settimana dallo storico */}
        <WeekSelectorDialog
          open={showWeekSelector}
          onOpenChange={setShowWeekSelector}
          schedules={publishedSchedules}
          onSelectSchedule={handleSelectSchedule}
        />
        
        {/* Layout Desktop e Tablet */}
        <div className="hidden sm:grid sm:grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {/* Colonna sinistra con calendario */}
          <div className="space-y-4 md:space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Calendario</CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={date => date && setDate(date)}
                  className="rounded-md"
                  locale={it}
                />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Riepilogo Turni</CardTitle>
              </CardHeader>
              <CardContent>
                {currentSchedule ? (
                  <div className="space-y-4">
                    <div className="text-sm">
                      <div className="font-medium">Periodo:</div>
                      <div>
                        {format(new Date(currentSchedule.startDate), "d MMMM", { locale: it })} - {format(new Date(currentSchedule.endDate), "d MMMM yyyy", { locale: it })}
                      </div>
                    </div>
                    
                    <div className="text-sm">
                      <div className="font-medium">Pubblicato:</div>
                      <div>
                        {currentSchedule.publishedAt ? 
                          format(new Date(currentSchedule.publishedAt), "d MMMM yyyy, HH:mm", { locale: it }) :
                          "Non ancora pubblicato"
                        }
                      </div>
                    </div>
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full mt-4"
                      onClick={() => setShowWeekSelector(true)}
                    >
                      <span className="material-icons text-sm mr-1">history</span>
                      Visualizza altri turni
                    </Button>
                    
                    <div className="text-sm">
                      <div className="font-medium">Totale ore settimanali:</div>
                      <div>
                        {formatHours(calculateTotalWorkHours(userShifts.filter(shift => shift.type === "work")))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    Nessun turno pubblicato disponibile.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {/* Colonna destra con visualizzatore turni */}
          <div className="md:col-span-2">
            <EmployeeScheduleViewer
              schedule={currentSchedule}
              shifts={allShifts}
              userShifts={userShifts}
            />
          </div>
        </div>
        
        {/* Layout Mobile */}
        <div className="sm:hidden space-y-4">
          <Card>
            <CardHeader className="p-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Riepilogo</CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowWeekSelector(true)}
              >
                <span className="material-icons text-sm mr-1">history</span>
                Altre settimane
              </Button>
            </CardHeader>
            <CardContent className="pb-3 pt-0">
              {currentSchedule ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <div className="font-medium">Periodo:</div>
                    <div>{format(new Date(currentSchedule.startDate), "d MMM", { locale: it })} - {format(new Date(currentSchedule.endDate), "d MMM", { locale: it })}</div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div className="font-medium">Ore settimanali:</div>
                    <div className="font-semibold text-blue-700">{formatHours(calculateTotalWorkHours(userShifts.filter(shift => shift.type === "work")))}</div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">
                  Nessun turno pubblicato disponibile.
                </div>
              )}
            </CardContent>
          </Card>
          
          <EmployeeScheduleViewer
            schedule={currentSchedule}
            shifts={allShifts}
            userShifts={userShifts}
          />
        </div>
      </div>
    </Layout>
  );
}