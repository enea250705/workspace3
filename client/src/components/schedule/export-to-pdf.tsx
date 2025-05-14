import { useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { calculateWorkHours, formatHours } from "@/lib/utils";

interface Schedule {
  id: number;
  startDate: string;
  endDate: string;
  isPublished: boolean;
}

interface Shift {
  id: number;
  userId: number;
  day: string;
  startTime: string;
  endTime: string;
  type: string;
  notes?: string;
}

interface User {
  id: number;
  username: string;
  fullName?: string;
  role: string;
  isActive: boolean;
}

interface ExportToPdfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedules: Schedule[];
  users: User[];
  fetchShifts: (scheduleId: number) => Promise<Shift[]>;
}

export function ExportToPdfDialog({
  open,
  onOpenChange,
  schedules,
  users,
  fetchShifts,
}: ExportToPdfDialogProps) {
  const { toast } = useToast();
  const [selectedSchedules, setSelectedSchedules] = useState<number[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  
  // Filtriamo solo gli schedule pubblicati e ordinati per data
  const publishedSchedules = schedules
    .filter(schedule => schedule.isPublished)
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  
  const handleToggleSchedule = (scheduleId: number) => {
    if (selectedSchedules.includes(scheduleId)) {
      setSelectedSchedules(selectedSchedules.filter(id => id !== scheduleId));
    } else {
      setSelectedSchedules([...selectedSchedules, scheduleId]);
    }
  };
  
  const handleSelectAll = () => {
    if (selectedSchedules.length === publishedSchedules.length) {
      setSelectedSchedules([]);
    } else {
      setSelectedSchedules(publishedSchedules.map(s => s.id));
    }
  };

  const generatePdfForSchedule = async (schedule: Schedule, shifts: Shift[]) => {
    // Creazione del contenitore temporaneo per il rendering HTML
    const tempContainer = document.createElement("div");
    tempContainer.style.position = "absolute";
    tempContainer.style.left = "-9999px";
    tempContainer.style.top = "-9999px";
    document.body.appendChild(tempContainer);
    
    // Otteniamo solo gli utenti che sono dipendenti attivi
    const activeEmployees = users.filter(user => user.role === "employee" && user.isActive);
    
    // Raggruppiamo i turni per giorno
    const dayNames = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"];
    const startDate = new Date(schedule.startDate);
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      return {
        date,
        name: format(date, "EEEE", { locale: it }),
        formattedDate: format(date, "yyyy-MM-dd")
      };
    });
    
    // Creazione dell'HTML per il PDF
    let htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px; width: 100%;">
        <h1 style="font-size: 20px; margin-bottom: 10px; color: #333;">Pianificazione Turni: ${format(new Date(schedule.startDate), "d MMMM", { locale: it })} - ${format(new Date(schedule.endDate), "d MMMM yyyy", { locale: it })}</h1>
        
        <div style="margin-bottom: 20px;">
          <div style="display: flex; gap: 15px; margin-top: 10px;">
            <div style="display: flex; align-items: center;">
              <div style="display: inline-block; width: 15px; height: 15px; background-color: #e6f7ff; border: 1px solid #ccc; margin-right: 5px;"></div>
              <span style="font-size: 12px;">X = In servizio</span>
            </div>
            <div style="display: flex; align-items: center;">
              <div style="display: inline-block; width: 15px; height: 15px; background-color: #f6ffed; border: 1px solid #ccc; margin-right: 5px;"></div>
              <span style="font-size: 12px;">F = Ferie</span>
            </div>
            <div style="display: flex; align-items: center;">
              <div style="display: inline-block; width: 15px; height: 15px; background-color: #fff2e8; border: 1px solid #ccc; margin-right: 5px;"></div>
              <span style="font-size: 12px;">P = Permesso</span>
            </div>
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px;">
          <thead>
            <tr>
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2; text-align: left;">Dipendente</th>
              ${weekDays.map(day => `
                <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2; text-align: center;">
                  ${day.name.charAt(0).toUpperCase() + day.name.slice(1)}<br>${format(day.date, "dd/MM", { locale: it })}
                </th>
              `).join('')}
              <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2; text-align: center;">Totale</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    // Aggiungiamo le righe per ogni dipendente
    for (const employee of activeEmployees) {
      const employeeName = employee.fullName || employee.username;
      let totalWeekHours = 0;
      
      htmlContent += `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">${employeeName}</td>
      `;
      
      // Aggiungiamo una cella per ogni giorno della settimana
      for (const day of weekDays) {
        // Filtriamo i turni per questo dipendente in questo giorno
        const dayShifts = shifts.filter(
          shift => shift.userId === employee.id && shift.day === day.formattedDate
        );
        
        // Calcoliamo il totale ore per questo giorno
        let dayHours = 0;
        dayShifts.forEach(shift => {
          if (shift.type === "work") {
            dayHours += calculateWorkHours(shift.startTime, shift.endTime);
          }
        });
        
        totalWeekHours += dayHours;
        
        // Determiniamo il tipo di cella e il contenuto
        let cellStyle = "border: 1px solid #ddd; padding: 8px; text-align: center;";
        let cellContent = "";
        
        if (dayShifts.length > 0) {
          const shiftTypes = new Set(dayShifts.map(s => s.type));
          
          if (shiftTypes.has("work")) {
            cellStyle += " background-color: #e6f7ff;";
            cellContent = `X (${formatHours(dayHours)})`;
          } else if (shiftTypes.has("vacation")) {
            cellStyle += " background-color: #f6ffed;";
            cellContent = "F";
          } else if (shiftTypes.has("leave")) {
            cellStyle += " background-color: #fff2e8;";
            cellContent = "P";
          }
        }
        
        htmlContent += `<td style="${cellStyle}">${cellContent}</td>`;
      }
      
      // Aggiungiamo la cella del totale settimanale
      htmlContent += `
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold;">
          ${formatHours(totalWeekHours)}
        </td>
      </tr>
      `;
    }
    
    htmlContent += `
          </tbody>
        </table>
      </div>
    `;
    
    // Rendiamo l'HTML nel contenitore temporaneo
    tempContainer.innerHTML = htmlContent;
    
    // Convertiamo l'HTML in un'immagine canvas
    const canvas = await html2canvas(tempContainer, {
      scale: 2,
      logging: false,
      useCORS: true
    });
    
    // Creiamo il PDF
    const pdf = new jsPDF('p', 'pt', 'a4');
    const imgWidth = 595;
    const imgHeight = canvas.height * imgWidth / canvas.width;
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
    
    // Rimuoviamo il contenitore temporaneo
    document.body.removeChild(tempContainer);
    
    return pdf;
  };
  
  const handleExport = async () => {
    if (selectedSchedules.length === 0) {
      toast({
        title: "Nessuna pianificazione selezionata",
        description: "Seleziona almeno una pianificazione da esportare.",
        variant: "destructive",
      });
      return;
    }
    
    setIsExporting(true);
    
    try {
      // Se abbiamo solo una pianificazione, creiamo un singolo PDF
      if (selectedSchedules.length === 1) {
        const scheduleId = selectedSchedules[0];
        const schedule = publishedSchedules.find(s => s.id === scheduleId);
        
        if (!schedule) {
          throw new Error("Pianificazione non trovata");
        }
        
        const shifts = await fetchShifts(scheduleId);
        const pdf = await generatePdfForSchedule(schedule, shifts);
        pdf.save(`Turni_${format(new Date(schedule.startDate), "dd-MM-yyyy", { locale: it })}.pdf`);
      } 
      // Se abbiamo più pianificazioni, creiamo un PDF multipagina
      else {
        const allSchedulesPdf = new jsPDF('p', 'pt', 'a4');
        
        let isFirstPage = true;
        
        for (const scheduleId of selectedSchedules) {
          const schedule = publishedSchedules.find(s => s.id === scheduleId);
          
          if (!schedule) continue;
          
          const shifts = await fetchShifts(scheduleId);
          const schedulePdf = await generatePdfForSchedule(schedule, shifts);
          
          // Aggiungiamo al PDF principale
          if (!isFirstPage) {
            allSchedulesPdf.addPage();
          }
          
          // Estraiamo i dati dal PDF singolo
          const pdfData = schedulePdf.output('arraybuffer');
          const dataURL = URL.createObjectURL(new Blob([pdfData], { type: 'application/pdf' }));
          
          // Aggiungiamo l'immagine alla pagina corrente
          allSchedulesPdf.setPage(isFirstPage ? 1 : allSchedulesPdf.getNumberOfPages());
          allSchedulesPdf.addPage();
          allSchedulesPdf.deletePage(allSchedulesPdf.getNumberOfPages());
          
          isFirstPage = false;
        }
        
        // Salviamo il PDF multipagina
        allSchedulesPdf.save(`Turni_Multipli_${format(new Date(), "dd-MM-yyyy", { locale: it })}.pdf`);
      }
      
      toast({
        title: "Esportazione completata",
        description: "Il PDF è stato generato con successo.",
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error("Errore durante l'esportazione del PDF:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'esportazione del PDF.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Esporta turni in PDF</DialogTitle>
          <DialogDescription>
            Seleziona le settimane di turni da esportare in formato PDF.
          </DialogDescription>
        </DialogHeader>
        
        <div className="max-h-[400px] overflow-y-auto py-2">
          <div className="mb-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="select-all"
                checked={selectedSchedules.length === publishedSchedules.length && publishedSchedules.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor="select-all" className="font-medium">Seleziona tutte</Label>
            </div>
          </div>
          
          {publishedSchedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna pianificazione pubblicata disponibile.</p>
          ) : (
            <div className="space-y-2">
              {publishedSchedules.map((schedule) => (
                <div key={schedule.id} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`schedule-${schedule.id}`}
                    checked={selectedSchedules.includes(schedule.id)}
                    onCheckedChange={() => handleToggleSchedule(schedule.id)}
                  />
                  <Label htmlFor={`schedule-${schedule.id}`} className="text-sm">
                    {format(new Date(schedule.startDate), "d MMMM", { locale: it })} - {format(new Date(schedule.endDate), "d MMMM yyyy", { locale: it })}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <DialogFooter className="flex flex-col sm:flex-row sm:justify-between sm:space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            Annulla
          </Button>
          <Button
            type="button"
            onClick={handleExport}
            disabled={selectedSchedules.length === 0 || isExporting}
            className="mt-2 sm:mt-0"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Esportazione in corso...
              </>
            ) : (
              <>Esporta in PDF</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}