import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { format, isSameDay, parseISO, addDays } from "date-fns";
import { it } from "date-fns/locale";
import { calculateTotalWorkHours, formatHours } from "@/lib/utils";

/**
 * Interfaccia per i dati di un dipendente
 */
export interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
}

/**
 * Interfaccia per i dati di un turno
 */
export interface Shift {
  id?: number;
  employeeId: number;
  userId?: number;
  date?: string;
  day?: string;
  startTime: string;
  endTime: string;
  type?: string;
  notes?: string;
  area?: string;
}

/**
 * Interfaccia per i dati di una pianificazione
 */
export interface Schedule {
  id: number;
  startDate: string;
  endDate: string;
  isPublished: boolean;
}

/**
 * Filtra i turni per un determinato giorno
 * @param shifts Array dei turni
 * @param day Giorno per cui filtrare i turni
 * @param dayName Nome del giorno in inglese
 * @returns Array dei turni filtrati per il giorno specificato
 */
function filterShiftsByDay(shifts: Shift[], day: Date, dayName: string): Shift[] {
  console.log(`Filtrando turni per ${day.toISOString().split('T')[0]} (${dayName})`);
  
  // Mappa per convertire i giorni della settimana in italiano a inglese
  const italianToEnglish: Record<string, string> = {
    "lunedì": "Monday",
    "martedì": "Tuesday",
    "mercoledì": "Wednesday",
    "giovedì": "Thursday",
    "venerdì": "Friday",
    "sabato": "Saturday",
    "domenica": "Sunday",
    // Versioni senza accento
    "lunedi": "Monday",
    "martedi": "Tuesday",
    "mercoledi": "Wednesday",
    "giovedi": "Thursday",
    "venerdi": "Friday",
    "sabato": "Saturday",
    "domenica": "Sunday"
  };
  
  return shifts.filter(shift => {
    // Se il turno ha un campo 'date', usa quello
    if (shift.date) {
      try {
        const shiftDate = new Date(shift.date);
        
        // Confronto diretto delle componenti della data
        const isSameDay = 
          shiftDate.getFullYear() === day.getFullYear() && 
          shiftDate.getMonth() === day.getMonth() && 
          shiftDate.getDate() === day.getDate();
        
        if (isSameDay) {
          console.log(`Turno trovato per data ${day.toISOString().split('T')[0]}:`, 
            JSON.stringify({
              id: shift.id,
              employeeId: shift.employeeId || shift.userId,
              date: shift.date,
              startTime: shift.startTime,
              endTime: shift.endTime,
              type: shift.type
            })
          );
        }
        
        return isSameDay;
      } catch (error) {
        console.error("Errore nel confronto date:", error, "per il turno:", JSON.stringify(shift));
        return false;
      }
    }
    // Altrimenti, usa il campo 'day'
    else if (shift.day) {
      // IMPORTANTE: Il campo 'day' potrebbe contenere il nome del giorno in inglese o italiano
      // Dobbiamo gestire entrambi i casi
      
      // Normalizza il giorno del turno (converti da italiano a inglese se necessario)
      const normalizedShiftDay = italianToEnglish[shift.day.toLowerCase()] || shift.day;
      
      // Confronta con il nome del giorno in inglese
      const isDayMatch = normalizedShiftDay.toLowerCase() === dayName.toLowerCase();
      
      if (isDayMatch) {
        console.log(`Turno trovato per giorno ${dayName} (${shift.day}):`, 
          JSON.stringify({
            id: shift.id,
            employeeId: shift.employeeId || shift.userId,
            day: shift.day,
            startTime: shift.startTime,
            endTime: shift.endTime,
            type: shift.type
          })
        );
      }
      
      return isDayMatch;
    }
    
    return false;
  });
}

/**
 * Genera un PDF con la pianificazione settimanale dei turni
 * Cattura direttamente la tabella HTML esistente per garantire una replica esatta
 * @param schedule Dati della pianificazione
 * @param shifts Array dei turni
 * @param employees Array dei dipendenti
 * @returns Promise che risolve con il PDF generato
 */
export async function generateSchedulePdf(
  schedule: Schedule,
  shifts: Shift[],
  employees: Employee[]
): Promise<jsPDF> {
  console.log("Inizio generazione PDF tramite cattura diretta della tabella HTML");
  
  // Trova la tabella di pianificazione nella pagina
  const scheduleTable = document.querySelector('.schedule-table-container') as HTMLElement;
  
  if (!scheduleTable) {
    console.error("Tabella di pianificazione non trovata nel DOM");
    throw new Error("Tabella di pianificazione non trovata");
  }
  
  // Crea un container temporaneo per il rendering del PDF
  const container = document.createElement('div');
  container.style.width = '1200px';
  container.style.padding = '20px';
  container.style.backgroundColor = 'white';
  container.style.fontFamily = 'Arial, sans-serif';
  
  // Aggiungi titolo e data
  const title = document.createElement('h1');
  title.textContent = 'Programma Settimanale';
  title.style.textAlign = 'center';
  title.style.marginBottom = '10px';
  container.appendChild(title);
  
  // Formatta le date
  const startDate = new Date(schedule.startDate);
  const endDate = new Date(schedule.endDate);
  
  const subtitle = document.createElement('h3');
  subtitle.textContent = `${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`;
  subtitle.style.textAlign = 'center';
  subtitle.style.marginBottom = '20px';
  container.appendChild(subtitle);
  
  // Clona la tabella esistente
  const tableClone = scheduleTable.cloneNode(true) as HTMLElement;
  
  // Rimuovi eventuali elementi interattivi o non necessari per il PDF
  const interactiveElements = tableClone.querySelectorAll('button, input, select, .no-print');
  interactiveElements.forEach(el => el.remove());
  
  // Aggiungi la tabella clonata al container
  container.appendChild(tableClone);
  
  // Aggiungi legenda
  const legend = document.createElement('div');
  legend.style.marginTop = '20px';
  legend.style.padding = '10px';
  legend.style.border = '1px solid #ddd';
  legend.style.borderRadius = '4px';
  legend.style.backgroundColor = '#f9f9f9';
  
  const legendTitle = document.createElement('h4');
  legendTitle.textContent = 'Legenda';
  legendTitle.style.marginTop = '0';
  legendTitle.style.marginBottom = '10px';
  legend.appendChild(legendTitle);
  
  const legendItems = [
    { symbol: 'X', description: 'In servizio', color: '#0066cc' },
    { symbol: 'F', description: 'Ferie', color: '#e67e22' },
    { symbol: 'P', description: 'Permesso', color: '#9b59b6' },
    { symbol: 'M', description: 'Malattia', color: '#e74c3c' }
  ];
  
  const legendGrid = document.createElement('div');
  legendGrid.style.display = 'grid';
  legendGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
  legendGrid.style.gap = '10px';
  
  legendItems.forEach(item => {
    const legendItem = document.createElement('div');
    legendItem.style.display = 'flex';
    legendItem.style.alignItems = 'center';
    
    const symbolSpan = document.createElement('span');
    symbolSpan.textContent = item.symbol;
    symbolSpan.style.fontWeight = 'bold';
    symbolSpan.style.color = item.color;
    symbolSpan.style.marginRight = '10px';
    symbolSpan.style.display = 'inline-block';
    symbolSpan.style.width = '20px';
    symbolSpan.style.height = '20px';
    symbolSpan.style.textAlign = 'center';
    symbolSpan.style.lineHeight = '20px';
    symbolSpan.style.border = '1px solid #ddd';
    symbolSpan.style.borderRadius = '3px';
    
    const descriptionSpan = document.createElement('span');
    descriptionSpan.textContent = item.description;
    
    legendItem.appendChild(symbolSpan);
    legendItem.appendChild(descriptionSpan);
    legendGrid.appendChild(legendItem);
  });
  
  legend.appendChild(legendGrid);
  container.appendChild(legend);
  
  // Aggiungi il container al DOM temporaneamente per il rendering
  document.body.appendChild(container);
  
  try {
    console.log("Inizio rendering HTML su canvas");
    // Usa html2canvas per convertire l'HTML in un'immagine
    const canvas = await html2canvas(container, {
      scale: 2, // Aumenta la qualità dell'immagine
      useCORS: true,
      logging: true,
      onclone: (clonedDoc) => {
        // Assicurati che tutti gli stili siano applicati correttamente
        const clonedElement = clonedDoc.querySelector('div');
        if (clonedElement) {
          clonedElement.style.display = 'block';
          
          // Assicurati che tutti gli stili siano visibili
          const allElements = clonedElement.querySelectorAll('*');
          allElements.forEach(el => {
            (el as HTMLElement).style.visibility = 'visible';
            (el as HTMLElement).style.opacity = '1';
          });
        }
      }
    });
    
    console.log("Canvas generato, creazione PDF");
    
    // Crea il PDF
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });
    
    // Calcola le dimensioni e la posizione dell'immagine nel PDF
    const imgWidth = 280;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    // Aggiungi l'immagine al PDF
    pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
    
    console.log("PDF generato con successo");
    return pdf;
  } catch (error) {
    console.error("Errore durante la generazione del PDF:", error);
    throw error;
  } finally {
    // Rimuovi il container temporaneo
    document.body.removeChild(container);
  }
}

/**
 * Esporta la pianificazione settimanale in formato PDF
 * @param schedule Dati della pianificazione
 * @param shifts Array dei turni
 * @param employees Array dei dipendenti
 */
export async function exportScheduleToPdf(
  schedule: Schedule,
  shifts: Shift[],
  employees: Employee[]
): Promise<void> {
  try {
    const pdf = await generateSchedulePdf(schedule, shifts, employees);
    
    // Salva il PDF
    const startDate = new Date(schedule.startDate);
    pdf.save(`Programma_${format(startDate, 'dd-MM-yyyy')}.pdf`);
  } catch (error) {
    console.error('Errore durante l\'esportazione del PDF:', error);
    throw error;
  }
} 