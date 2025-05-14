import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, subDays, format, parse } from "date-fns";
import { it } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeAgo(date: Date | string) {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(dateObj, {
    addSuffix: true,
    locale: it,
  });
}

export function relativeDateFromNow(days: number) {
  return subDays(new Date(), days);
}

export function formatDate(date: Date | string, formatStr: string = "dd/MM/yyyy") {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return format(dateObj, formatStr, { locale: it });
}

export function parseLocalDate(date: string, formatStr: string = "yyyy-MM-dd") {
  return parse(date, formatStr, new Date());
}

export function generateTimeSlots(startHour: number, endHour: number, interval: number = 30) {
  const timeSlots = [];
  for (let hour = startHour; hour <= endHour; hour++) {
    for (let min = 0; min < 60; min += interval) {
      const formattedHour = hour.toString().padStart(2, '0');
      const formattedMin = min.toString().padStart(2, '0');
      timeSlots.push(`${formattedHour}:${formattedMin}`);
    }
  }
  return timeSlots;
}

/**
 * Formatta un numero di ore in una stringa leggibile
 * Es. 7.5 -> "7h 30m"
 * @param hours Ore da formattare
 * @returns Stringa formattata con ore e minuti
 */
export function formatHours(hours: number): string {
  if (isNaN(hours) || hours === 0) return "0h";
  
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  if (minutes === 0) {
    return `${wholeHours}h`;
  } else {
    return `${wholeHours}h ${minutes}m`;
  }
}

/**
 * Converte una stringa oraria (HH:MM) in ore decimali
 * Es. "09:30" -> 9.5
 * @param timeStr Orario in formato "HH:MM"
 * @returns Ore in formato decimale
 */
export function convertToHours(timeStr: string): number {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  
  const parts = timeStr.split(':');
  if (parts.length !== 2) return 0;
  
  const [hours, minutes] = parts.map(Number);
  
  if (isNaN(hours) || isNaN(minutes)) return 0;
  
  return hours + (minutes / 60);
}

/**
 * Calcola le ore di lavoro tra un orario di inizio e fine
 * Gestisce correttamente gli orari che attraversano la mezzanotte
 * @param startTime Orario di inizio in formato "HH:MM"
 * @param endTime Orario di fine in formato "HH:MM"
 * @returns Ore di lavoro in formato decimale
 */
export function calculateWorkHours(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  
  const startParts = startTime.split(':');
  const endParts = endTime.split(':');
  
  if (startParts.length !== 2 || endParts.length !== 2) return 0;
  
  const startHour = parseInt(startParts[0], 10);
  const startMinute = parseInt(startParts[1], 10);
  const endHour = parseInt(endParts[0], 10);
  const endMinute = parseInt(endParts[1], 10);
  
  if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) return 0;
  
  // Calcola i minuti totali per ogni orario
  const startTotalMinutes = (startHour * 60) + startMinute;
  const endTotalMinutes = (endHour * 60) + endMinute;
  
  // Gestisci il caso di attraversamento della mezzanotte
  let diffMinutes = endTotalMinutes - startTotalMinutes;
  if (diffMinutes < 0) {
    diffMinutes += 24 * 60; // Aggiungi un giorno in minuti
  }
  
  // Converti i minuti in ore con precisione a 2 decimali
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  const decimalHours = hours + (minutes / 60);
  
  // Arrotonda a 2 decimali per evitare problemi di precisione floating point
  return Math.round(decimalHours * 100) / 100;
}

/**
 * Calcola le ore di lavoro totali da un array di turni
 * @param shifts Array di turni con orari di inizio e fine
 * @returns Ore totali in formato decimale (es. 7.5 per 7 ore e 30 minuti)
 */
export function calculateTotalWorkHours(shifts: any[]): number {
  if (!shifts || shifts.length === 0) return 0;
  
  return shifts.reduce((total, shift) => {
    // Estrai le ore e i minuti dagli orari di inizio e fine
    const [startHour, startMinute] = shift.startTime.split(':').map(Number);
    const [endHour, endMinute] = shift.endTime.split(':').map(Number);
    
    // Calcola i minuti totali per ogni orario
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;
    
    // Calcola la differenza in minuti
    let diffMinutes = endTotalMinutes - startTotalMinutes;
    
    // Se l'orario di fine è prima dell'orario di inizio, assumiamo che il turno vada oltre la mezzanotte
    if (diffMinutes < 0) {
      diffMinutes += 24 * 60; // Aggiungi 24 ore in minuti
    }
    
    // Converti i minuti in ore decimali (es. 90 minuti = 1.5 ore)
    const hours = diffMinutes / 60;
    
    console.log(`Calcolo ore per turno ${shift.startTime}-${shift.endTime}: ${hours} ore`);
    
    return total + hours;
    }, 0);
}