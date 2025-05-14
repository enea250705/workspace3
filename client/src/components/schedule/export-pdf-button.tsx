import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportScheduleToPdf, Schedule, Shift, Employee } from "./pdf-export-utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { calculateTotalWorkHours, formatHours } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface ExportPdfButtonProps {
  schedule: Schedule;
  shifts: Shift[];
  employees: Employee[];
  className?: string;
}

/**
 * Componente pulsante per l'esportazione PDF dei turni
 */
export function ExportPdfButton({ schedule, shifts, employees, className }: ExportPdfButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugData, setDebugData] = useState<any>(null);
  const { toast } = useToast();

  // Aggiungi la classe schedule-table-container alla tabella dei turni quando necessario
  useEffect(() => {
    // Trova la tabella dei turni
    const scheduleTable = document.querySelector('.schedule-container table');
    
    if (scheduleTable && scheduleTable.parentElement) {
      // Aggiungi la classe al contenitore della tabella
      scheduleTable.parentElement.classList.add('schedule-table-container');
    }
  }, []);

  // Funzione per testare il calcolo delle ore
  const testHoursCalculation = () => {
    const testCases = [
      { startTime: "04:00", endTime: "06:00", expected: 2 },
      { startTime: "08:00", endTime: "12:30", expected: 4.5 },
      { startTime: "14:00", endTime: "18:00", expected: 4 },
      { startTime: "22:00", endTime: "02:00", expected: 4 }, // Test turno notturno
    ];
    
    const results = testCases.map(test => {
      const hours = calculateTotalWorkHours([{ startTime: test.startTime, endTime: test.endTime }]);
      return {
        ...test,
        actual: hours,
        passed: Math.abs(hours - test.expected) < 0.01
      };
    });
    
    console.log("Test calcolo ore:", results);
    return results;
  };

  const analyzeShifts = () => {
    // Esegui test del calcolo ore
    const hoursTests = testHoursCalculation();
    
    // Verifico la struttura dei turni
    const hasDateField = shifts.some(s => s.date);
    const hasDayField = shifts.some(s => s.day);
    const hasEmployeeId = shifts.some(s => s.employeeId);
    const hasUserId = shifts.some(s => s.userId);
    
    // Verifico se i dipendenti hanno corrispondenza con i turni
    const employeeIds = new Set(employees.map(e => e.id));
    const shiftEmployeeIds = new Set(shifts.map(s => s.employeeId || s.userId));
    const matchingIds = [...shiftEmployeeIds].filter(id => employeeIds.has(id as number));
    
    // Verifico i turni per giorno
    const startDate = new Date(schedule.startDate);
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      return date;
    });
    
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const shiftsPerDay: Record<string, any[]> = {};
    
    days.forEach((day, index) => {
      const dayName = dayNames[day.getDay()];
      const dayShifts = shifts.filter(shift => {
        if (shift.date) {
          try {
            const shiftDate = new Date(shift.date);
            return shiftDate.getFullYear() === day.getFullYear() && 
                   shiftDate.getMonth() === day.getMonth() && 
                   shiftDate.getDate() === day.getDate();
          } catch (error) {
            return false;
          }
        } else if (shift.day) {
          // Verifica sia con confronto diretto che con conversione in minuscolo
          return shift.day === dayName || 
                 shift.day.toLowerCase() === dayName.toLowerCase() ||
                 shift.day.toLowerCase() === dayName.toLowerCase().substring(0, 3);
        }
        return false;
      });
      
      shiftsPerDay[dayName] = dayShifts;
    });
    
    // Calcola le ore per dipendente
    const employeeHours: Record<number, number> = {};
    
    employees.forEach(employee => {
      const employeeShifts = shifts.filter(shift => {
        const shiftEmployeeId = shift.employeeId || shift.userId;
        return shiftEmployeeId === employee.id;
      });
      
      const workShifts = employeeShifts.filter(shift => shift.type === 'work' || !shift.type);
      const totalHours = calculateTotalWorkHours(workShifts);
      employeeHours[employee.id] = totalHours;
    });
    
    // Creo un oggetto con tutte le informazioni di debug
    const debugInfo = {
      shiftCount: shifts.length,
      employeeCount: employees.length,
      hasDateField,
      hasDayField,
      hasEmployeeId,
      hasUserId,
      matchingIdsCount: matchingIds.length,
      shiftsPerDay,
      employeeHours,
      hoursCalculationTests: hoursTests,
      firstShift: shifts.length > 0 ? shifts[0] : null,
      firstEmployee: employees.length > 0 ? employees[0] : null,
      scheduleInfo: {
        id: schedule.id,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        isPublished: schedule.isPublished
      }
    };
    
    setDebugData(debugInfo);
    setShowDebug(true);
  };

  const handleExport = async () => {
    if (!schedule || !shifts || !employees) {
      toast({
        title: "Errore",
        description: "Dati mancanti per l'esportazione PDF",
        variant: "destructive",
      });
      return;
    }

    if (shifts.length === 0) {
      toast({
        title: "Nessun turno disponibile",
        description: "Non ci sono turni da esportare per questa settimana",
        variant: "destructive",
      });
      return;
    }

    // Assicurati che la tabella abbia la classe corretta per l'esportazione
    const scheduleTable = document.querySelector('.schedule-container table');
    if (scheduleTable && scheduleTable.parentElement) {
      scheduleTable.parentElement.classList.add('schedule-table-container');
    } else {
      toast({
        title: "Errore",
        description: "Tabella dei turni non trovata nella pagina",
        variant: "destructive",
      });
      return;
    }

    // Test calcolo ore
    const hoursTests = testHoursCalculation();
    const allTestsPassed = hoursTests.every(test => test.passed);
    
    if (!allTestsPassed) {
      console.warn("⚠️ Alcuni test di calcolo ore non sono passati:", hoursTests);
    } else {
      console.log("✅ Tutti i test di calcolo ore sono passati");
    }

    // Log per debug dettagliato
    console.log("===== DATI PER ESPORTAZIONE PDF =====");
    console.log("Schedule:", JSON.stringify(schedule, null, 2));
    console.log("Shifts:", JSON.stringify(shifts, null, 2));
    console.log("Employees:", JSON.stringify(employees, null, 2));
    console.log("Numero di turni:", shifts.length);
    console.log("Numero di dipendenti:", employees.length);
    
    // Verifica formato date
    console.log("Data inizio:", new Date(schedule.startDate).toISOString());
    console.log("Data fine:", new Date(schedule.endDate).toISOString());
    
    // Verifica formato turni
    if (shifts.length > 0) {
      console.log("===== DETTAGLI PRIMO TURNO =====");
      console.log("Esempio turno completo:", JSON.stringify(shifts[0], null, 2));
      
      // Verifica il formato della data/giorno
      if (shifts[0].date) {
        console.log("Formato data turno:", new Date(shifts[0].date).toISOString());
      } else if (shifts[0].day) {
        console.log("Giorno turno:", shifts[0].day);
      }
      
      // Verifica ID dipendente
      console.log("ID dipendente:", shifts[0].employeeId || shifts[0].userId);
      
      // Verifica corrispondenza con dipendente
      const employee = employees.find(e => e.id === (shifts[0].employeeId || shifts[0].userId));
      if (employee) {
        console.log("Dipendente trovato:", `${employee.firstName} ${employee.lastName}`);
      } else {
        console.log("ERRORE: Dipendente non trovato per ID", shifts[0].employeeId || shifts[0].userId);
        console.log("ID dipendenti disponibili:", employees.map(e => e.id));
      }
    }
    
    // Verifica se ci sono turni per ogni giorno della settimana
    const startDate = new Date(schedule.startDate);
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      return date;
    });
    
    console.log("===== VERIFICA TURNI PER GIORNO =====");
    days.forEach((day, index) => {
      const dayShifts = shifts.filter(shift => {
        if (shift.date) {
          try {
            const shiftDate = new Date(shift.date);
            return shiftDate.getFullYear() === day.getFullYear() && 
                   shiftDate.getMonth() === day.getMonth() && 
                   shiftDate.getDate() === day.getDate();
          } catch (error) {
            return false;
          }
        } else if (shift.day) {
          const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          return shift.day === dayNames[day.getDay()];
        }
        return false;
      });
      
      console.log(`Giorno ${index + 1} (${day.toISOString().split('T')[0]}):`, dayShifts.length, "turni");
      if (dayShifts.length > 0) {
        console.log("  Esempio turno:", JSON.stringify(dayShifts[0], null, 2));
      }
    });

    // Assicuriamoci che tutti i turni abbiano l'ID dipendente corretto
    const processedShifts = shifts.map(shift => {
      // Se il turno ha userId ma non employeeId, copiamo userId in employeeId
      if (!shift.employeeId && shift.userId) {
        return { ...shift, employeeId: shift.userId };
      }
      return shift;
    });

    setIsExporting(true);

    try {
      await exportScheduleToPdf(schedule, processedShifts, employees);
      
      toast({
        title: "Esportazione completata",
        description: "Il PDF è stato generato con successo",
      });
    } catch (error) {
      console.error("Errore durante l'esportazione PDF:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'esportazione del PDF",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <div className="flex space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={isExporting}
          className={className}
        >
          {isExporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Esportazione in corso...
            </>
          ) : (
            <>
              <span className="material-icons text-xs sm:text-sm mr-1">download</span>
              Esporta PDF
            </>
          )}
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={analyzeShifts}
          className="px-2"
          title="Diagnostica problemi PDF"
        >
          <span className="material-icons text-xs sm:text-sm">bug_report</span>
        </Button>
      </div>
      
      <Dialog open={showDebug} onOpenChange={setShowDebug}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Diagnostica esportazione PDF</DialogTitle>
            <DialogDescription>
              Analisi dei dati per l'esportazione PDF
            </DialogDescription>
          </DialogHeader>
          
          {debugData && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded p-3">
                  <h3 className="font-bold mb-2">Informazioni generali</h3>
                  <ul className="space-y-1">
                    <li><span className="font-semibold">Numero turni:</span> {debugData.shiftCount}</li>
                    <li><span className="font-semibold">Numero dipendenti:</span> {debugData.employeeCount}</li>
                    <li><span className="font-semibold">Campo 'date' presente:</span> {debugData.hasDateField ? 'Sì' : 'No'}</li>
                    <li><span className="font-semibold">Campo 'day' presente:</span> {debugData.hasDayField ? 'Sì' : 'No'}</li>
                    <li><span className="font-semibold">Campo 'employeeId' presente:</span> {debugData.hasEmployeeId ? 'Sì' : 'No'}</li>
                    <li><span className="font-semibold">Campo 'userId' presente:</span> {debugData.hasUserId ? 'Sì' : 'No'}</li>
                    <li><span className="font-semibold">ID dipendenti corrispondenti:</span> {debugData.matchingIdsCount}</li>
                  </ul>
                </div>
                
                <div className="border rounded p-3">
                  <h3 className="font-bold mb-2">Pianificazione</h3>
                  <ul className="space-y-1">
                    <li><span className="font-semibold">ID:</span> {debugData.scheduleInfo.id}</li>
                    <li><span className="font-semibold">Data inizio:</span> {new Date(debugData.scheduleInfo.startDate).toLocaleDateString()}</li>
                    <li><span className="font-semibold">Data fine:</span> {new Date(debugData.scheduleInfo.endDate).toLocaleDateString()}</li>
                    <li><span className="font-semibold">Pubblicato:</span> {debugData.scheduleInfo.isPublished ? 'Sì' : 'No'}</li>
                  </ul>
                </div>
              </div>
              
              <div className="border rounded p-3">
                <h3 className="font-bold mb-2">Test calcolo ore</h3>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-1 text-left">Orario</th>
                      <th className="border p-1 text-left">Atteso</th>
                      <th className="border p-1 text-left">Calcolato</th>
                      <th className="border p-1 text-left">Risultato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debugData.hoursCalculationTests.map((test: any, index: number) => (
                      <tr key={index} className={test.passed ? 'bg-green-50' : 'bg-red-50'}>
                        <td className="border p-1">{test.startTime} - {test.endTime}</td>
                        <td className="border p-1">{test.expected}h</td>
                        <td className="border p-1">{test.actual}h</td>
                        <td className="border p-1">
                          {test.passed ? 
                            <span className="text-green-600">✓ OK</span> : 
                            <span className="text-red-600">✗ Errore</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="border rounded p-3">
                <h3 className="font-bold mb-2">Ore per dipendente</h3>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-1 text-left">Dipendente</th>
                      <th className="border p-1 text-left">Ore totali</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((employee) => (
                      <tr key={employee.id}>
                        <td className="border p-1">{employee.firstName} {employee.lastName}</td>
                        <td className="border p-1">{formatHours(debugData.employeeHours[employee.id] || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="border rounded p-3">
                <h3 className="font-bold mb-2">Turni per giorno</h3>
                <div className="grid grid-cols-7 gap-2">
                  {Object.entries(debugData.shiftsPerDay).map(([day, shifts]) => (
                    <div key={day} className="border rounded p-2">
                      <h4 className="font-semibold">{day}</h4>
                      <p className="text-sm">{(shifts as any[]).length} turni</p>
                      {(shifts as any[]).length > 0 && (
                        <details>
                          <summary className="cursor-pointer text-blue-600 text-xs">Dettagli</summary>
                          <pre className="text-xs mt-1 bg-gray-100 p-1 overflow-x-auto">
                            {JSON.stringify((shifts as any[])[0], null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {debugData.firstShift && (
                <div className="border rounded p-3">
                  <h3 className="font-bold mb-2">Esempio turno</h3>
                  <pre className="text-xs bg-gray-100 p-2 overflow-x-auto">
                    {JSON.stringify(debugData.firstShift, null, 2)}
                  </pre>
                </div>
              )}
              
              {debugData.firstEmployee && (
                <div className="border rounded p-3">
                  <h3 className="font-bold mb-2">Esempio dipendente</h3>
                  <pre className="text-xs bg-gray-100 p-2 overflow-x-auto">
                    {JSON.stringify(debugData.firstEmployee, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setShowDebug(false)}>Chiudi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 