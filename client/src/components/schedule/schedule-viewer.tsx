import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { formatDate, formatHours, calculateTotalWorkHours, calculateWorkHours } from "@/lib/utils";

type ScheduleViewerProps = {
  schedule: any;
  shifts: any[];
  onDownloadPdf: () => void;
};

export function ScheduleViewer({ schedule, shifts, onDownloadPdf }: ScheduleViewerProps) {
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  
  if (!schedule) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <span className="material-icons text-gray-400 text-5xl mb-4">event_busy</span>
            <h3 className="text-lg font-medium mb-2">Nessun turno disponibile</h3>
            <p className="text-gray-500">Non ci sono turni pubblicati per il periodo selezionato.</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Calculate days of the week
  const startDate = new Date(schedule.startDate);
  const endDate = new Date(schedule.endDate);
  
  const weekDays = [];
  let currentDate = startDate;
  
  while (currentDate <= endDate) {
    weekDays.push({
      date: new Date(currentDate),
      name: format(currentDate, "EEEE", { locale: it }),
      formattedDate: format(currentDate, "d/M", { locale: it }),
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Group shifts by day
  const shiftsByDay: Record<string, any[]> = {};
  
  shifts.forEach(shift => {
    if (!shiftsByDay[shift.day]) {
      shiftsByDay[shift.day] = [];
    }
    
    shiftsByDay[shift.day].push(shift);
  });
  
  // Calculate total hours using the improved utility function
  const totalHours = calculateTotalWorkHours(shifts.filter(shift => shift.type === "work"));
  
  // Calculate working days
  const workingDays = Object.keys(shiftsByDay).length;
  
  return (
    <Card className="bg-white rounded-lg shadow-sm border border-gray-200">
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-condensed font-medium">I Miei Turni</h2>
            <p className="text-sm text-gray-500">
              Settimana: {formatDate(schedule.startDate)} - {formatDate(schedule.endDate)}
            </p>
          </div>
          <div>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
            >
              <span className="material-icons text-sm">calendar_today</span>
              Cambia Settimana
            </Button>
          </div>
        </div>
        
        {/* Calendar View */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const dayShifts = shiftsByDay[day.name] || [];
            const hasWorkShift = dayShifts.some(s => s.type === "work");
            const hasVacation = dayShifts.some(s => s.type === "vacation");
            const hasLeave = dayShifts.some(s => s.type === "leave");
            
            // Calculate total hours for the day using the improved utility function
            const dayHours = calculateTotalWorkHours(dayShifts.filter(shift => shift.type === "work"));
            
            return (
              <div key={day.name} className="bg-gray-50 p-3 rounded border border-gray-200">
                <p className="font-medium text-sm mb-1">
                  {day.name} {day.formattedDate}
                </p>
                
                {hasWorkShift && dayShifts
                  .filter(s => s.type === "work")
                  .map((shift, index) => (
                    <div key={index} className="bg-blue-100 p-2 rounded border border-blue-200 mb-2">
                      <p className="text-xs font-medium">Turno: {
                        parseInt(shift.startTime) < 12 
                          ? "Mattina" 
                          : parseInt(shift.startTime) < 18 
                          ? "Pomeriggio" 
                          : "Sera"
                      }</p>
                      <p className="text-xs">{shift.startTime} - {shift.endTime}</p>
                      {shift.area && <p className="text-xs">Area: {shift.area}</p>}
                      {shift.notes && <p className="text-xs">Note: {shift.notes}</p>}
                    </div>
                  ))}
                
                {hasVacation && (
                  <div className="bg-red-100 p-2 rounded border border-red-200 mb-2">
                    <p className="text-xs font-medium">Ferie</p>
                  </div>
                )}
                
                {hasLeave && (
                  <div className="bg-yellow-100 p-2 rounded border border-yellow-200 mb-2">
                    <p className="text-xs font-medium">Permesso</p>
                  </div>
                )}
                
                {!hasWorkShift && !hasVacation && !hasLeave && (
                  <div className="bg-gray-100 p-2 rounded border border-gray-200 mb-2">
                    <p className="text-xs font-medium">Riposo</p>
                  </div>
                )}
                
                <p className="text-xs text-gray-500">{formatHours(dayHours)} lavorative</p>
              </div>
            );
          })}
        </div>
        
        {/* Weekly Summary */}
        <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200">
          <div className="flex flex-wrap gap-4">
            <div>
              <p className="text-xs text-gray-500">Ore Totali Settimana</p>
              <p className="text-lg font-medium">{formatHours(totalHours)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Giorni Lavorativi</p>
              <p className="text-lg font-medium">{workingDays}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Riposi</p>
              <p className="text-lg font-medium">{7 - workingDays}</p>
            </div>
          </div>
        </div>
        
        {/* Notification Banner */}
        {schedule.isPublished && schedule.publishedAt && (
          <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200 flex items-start">
            <span className="material-icons text-primary mr-2">notifications</span>
            <div>
              <p className="text-sm font-medium">Notifica</p>
              <p className="text-xs text-gray-700">
                Il tuo orario settimanale è stato aggiornato il {formatDate(schedule.publishedAt)}. 
                Verificalo attentamente e contatta l'amministratore in caso di problemi.
              </p>
            </div>
          </div>
        )}
        
        <div className="mt-4 flex justify-end">
          <Button
            onClick={onDownloadPdf}
            className="flex items-center gap-1"
          >
            <span className="material-icons text-sm">download</span>
            Scarica PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
