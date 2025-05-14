import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, formatHours, calculateTotalWorkHours, convertToHours } from "@/lib/utils";
import { downloadPdf, generatePayslipFilename, generateTaxDocFilename } from "@/lib/pdf-utils";
import { Link } from "wouter";

export function EmployeeDashboard() {
  const { user } = useAuth();
  
  const { data: mySchedule } = useQuery({
    queryKey: ["/api/schedules"],
  });
  
  const { data: myShifts = [] } = useQuery({
    queryKey: [`/api/schedules/${mySchedule?.id}/shifts`],
    enabled: !!mySchedule?.id,
  });
  
  const { data: myTimeOffRequests = [] } = useQuery({
    queryKey: ["/api/time-off-requests"],
  });
  
  const { data: myDocuments = [] } = useQuery({
    queryKey: ["/api/documents"],
  });
  
  // Filter time off requests
  const pendingRequests = myTimeOffRequests.filter((req: any) => req.status === "pending");
  const approvedRequests = myTimeOffRequests.filter((req: any) => req.status === "approved");
  
  // Calcolo delle ore totali della settimana corrente utilizzando la funzione centralizzata
  const totalHoursThisWeek = calculateTotalWorkHours(
    myShifts.filter((shift: any) => shift.type === "work")
  );
  
  // Get day names for the week
  const getDayName = (date: string) => {
    const days = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
    return days[new Date(date).getDay()];
  };
  
  // Group shifts by day and remove duplicates based on startTime-endTime combination
  const shiftsByDay = myShifts.reduce((acc: any, shift: any) => {
    if (!acc[shift.day]) {
      acc[shift.day] = [];
    }
    
    // Check if this exact time slot already exists for this day to avoid duplicates
    const existingShiftIndex = acc[shift.day].findIndex((s: any) => 
      s.startTime === shift.startTime && 
      s.endTime === shift.endTime && 
      s.type === shift.type
    );
    
    // Add only if not duplicate
    if (existingShiftIndex === -1) {
      acc[shift.day].push(shift);
    }
    
    return acc;
  }, {});
  
  // Mostra tutti i giorni della settimana, non solo i primi due
  const upcomingShifts = Object.entries(shiftsByDay)
    .map(([day, shifts]) => ({ day, shifts: shifts as any[] }))
    // Ordina i giorni secondo l'ordine corretto della settimana (da Lunedì a Domenica)
    .sort((a, b) => {
      const dayOrder = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"];
      return dayOrder.indexOf(a.day.toLowerCase()) - dayOrder.indexOf(b.day.toLowerCase());
    });
  
  // Get the number of working days (solo giorni con turni di lavoro)
  const workingDays = Object.entries(shiftsByDay)
    .filter(([_, shifts]: [string, any[]]) => 
      shifts.some((shift: any) => shift.type === "work")
    ).length;
  
  // Get latest documents
  const latestPayslip = myDocuments
    .filter((doc: any) => doc.type === "payslip")
    .sort((a: any, b: any) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0];
  
  const latestTaxDoc = myDocuments
    .filter((doc: any) => doc.type === "tax_document")
    .sort((a: any, b: any) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0];
    
  // Funzioni per il download dei documenti
  const handleDownloadPayslip = () => {
    if (!latestPayslip) return;
    downloadPdf(
      generatePayslipFilename(latestPayslip.period, user?.fullName || user?.username || ""),
      latestPayslip.fileData
    );
  };
  
  const handleDownloadTaxDoc = () => {
    if (!latestTaxDoc) return;
    downloadPdf(
      generateTaxDocFilename(latestTaxDoc.period, user?.fullName || user?.username || ""),
      latestTaxDoc.fileData
    );
  };
  
  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <Card className="bg-gradient-to-r from-primary to-blue-600 text-white">
        <CardContent className="p-6">
          <h2 className="text-2xl font-bold mb-2">Benvenuto, {user?.name}!</h2>
          <p className="opacity-90">Ecco un riepilogo dei tuoi turni e richieste.</p>
        </CardContent>
      </Card>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm">Ore Programmate</p>
                <p className="text-2xl font-medium">
                  {formatHours(Math.round(totalHoursThisWeek * 100) / 100)}
                </p>
              </div>
              <div className="bg-blue-100 p-2 rounded-lg">
                <span className="material-icons text-primary">schedule</span>
              </div>
            </div>
            <div className="mt-4 text-xs text-gray-500">
              Questa settimana
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm">Giorni Lavorativi</p>
                <p className="text-2xl font-medium">{workingDays}</p>
              </div>
              <div className="bg-green-100 p-2 rounded-lg">
                <span className="material-icons text-success">event_available</span>
              </div>
            </div>
            <div className="mt-4 text-xs text-gray-500">
              Su 7 giorni
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm">Richieste Ferie</p>
                <p className="text-2xl font-medium">{pendingRequests.length}</p>
              </div>
              <div className="bg-amber-100 p-2 rounded-lg">
                <span className="material-icons text-warning">pending_actions</span>
              </div>
            </div>
            <div className="mt-4 text-xs text-gray-500">
              In attesa di approvazione
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Upcoming Shifts */}
      <Card>
        <CardHeader className="border-b px-4 py-3 flex justify-between items-center">
          <CardTitle className="text-base font-medium">Prossimi Turni</CardTitle>
          <Link href="/my-schedule">
            <Button variant="link" size="sm" className="h-auto p-0">
              Vedi tutti
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-4">
          {!mySchedule || upcomingShifts.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              Nessun turno programmato
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingShifts.map(({ day, shifts }: any) => (
                <div key={day} className="border rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-medium">
                      {/* Capitalizza il primo carattere del giorno */}
                      {day.charAt(0).toUpperCase() + day.slice(1)}
                    </h3>
                    <div className="text-xs text-gray-500 font-medium">
                      {formatHours(Math.round(calculateTotalWorkHours(shifts.filter((shift: any) => shift.type === "work")) * 100) / 100)}
                    </div>
                  </div>
                  
                  {/* Raggruppa i turni per tipo */}
                  {(() => {
                    // Raggruppa i turni per tipo
                    const workShifts = shifts.filter(s => s.type === "work");
                    const vacationShifts = shifts.filter(s => s.type === "vacation");
                    const leaveShifts = shifts.filter(s => s.type === "leave");
                    
                    // Ordina i turni di lavoro per orario di inizio
                    const sortedWorkShifts = [...workShifts].sort((a, b) => {
                      return convertToHours(a.startTime) - convertToHours(b.startTime);
                    });
                    
                    // Consolida gli slot consecutivi in un unico turno
                    const consolidatedWorkShifts = [];
                    let currentShift = null;
                    
                    for (const shift of sortedWorkShifts) {
                      if (!currentShift) {
                        currentShift = {...shift};
                        continue;
                      }
                      
                      // Se questo slot inizia esattamente quando finisce quello precedente, sono consecutivi
                      // Considerando che ogni slot è di 30 minuti
                      if (shift.startTime === currentShift.endTime) {
                        // Estendi l'orario di fine del turno corrente
                        currentShift.endTime = shift.endTime;
                      } else {
                        // Se non è consecutivo, aggiungi il turno corrente e inizia uno nuovo
                        consolidatedWorkShifts.push(currentShift);
                        currentShift = {...shift};
                      }
                    }
                    
                    // Aggiungi l'ultimo turno se esiste
                    if (currentShift) {
                      consolidatedWorkShifts.push(currentShift);
                    }
                    
                    return (
                      <>
                        {/* Turni di lavoro */}
                        {consolidatedWorkShifts.length > 0 && (
                          <div className="mb-3">
                            {/* Mostra un unico turno giornaliero complessivo */}
                            <div className="p-2 mb-2 rounded-md bg-blue-50 border border-blue-100">
                              <div className="flex justify-between items-center">
                                <div>
                                  <p className="text-sm font-medium">
                                    {/* Mostra solo il primo orario di inizio e l'ultimo orario di fine */}
                                    {sortedWorkShifts[0]?.startTime} - {sortedWorkShifts[sortedWorkShifts.length - 1]?.endTime}
                                  </p>
                                  {/* Mostra tutte le aree coinvolte se diverse */}
                                  {(() => {
                                    const uniqueAreas = [...new Set(sortedWorkShifts
                                      .filter(s => s.area)
                                      .map(s => s.area)
                                    )];
                                    
                                    if (uniqueAreas.length === 0) return null;
                                    
                                    return (
                                      <p className="text-xs text-gray-600">
                                        Area: {uniqueAreas.join(', ')}
                                      </p>
                                    );
                                  })()}
                                </div>
                                <span className="material-icons text-sm text-blue-500">work</span>
                              </div>
                              
                              {/* Se ci sono orari non consecutivi, mostrali come dettaglio */}
                              {consolidatedWorkShifts.length > 1 && (
                                <div className="mt-2 text-xs text-gray-500">
                                  <p className="font-medium">Dettaglio turni:</p>
                                  <ul className="list-disc pl-4 mt-1">
                                    {consolidatedWorkShifts.map((shift, index) => (
                                      <li key={index}>{shift.startTime} - {shift.endTime}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Ferie */}
                        {vacationShifts.length > 0 && (
                          <div className="mb-3">
                            {vacationShifts.map((shift: any) => (
                              <div 
                                key={shift.id}
                                className="p-2 mb-2 rounded-md bg-red-50 border border-red-100"
                              >
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p className="text-sm font-medium">Ferie</p>
                                    {shift.area && (
                                      <p className="text-xs text-gray-600">Area: {shift.area}</p>
                                    )}
                                  </div>
                                  <span className="material-icons text-sm text-red-500">beach_access</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Permessi */}
                        {leaveShifts.length > 0 && (
                          <div className="mb-3">
                            {leaveShifts.map((shift: any) => (
                              <div 
                                key={shift.id}
                                className="p-2 mb-2 rounded-md bg-yellow-50 border border-yellow-100"
                              >
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p className="text-sm font-medium">Permesso</p>
                                    {shift.area && (
                                      <p className="text-xs text-gray-600">Area: {shift.area}</p>
                                    )}
                                  </div>
                                  <span className="material-icons text-sm text-yellow-500">time_to_leave</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Two-column layout for Time Off and Documents */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Time Off Requests */}
        <Card>
          <CardHeader className="border-b px-4 py-3 flex justify-between items-center">
            <CardTitle className="text-base font-medium">Le Mie Richieste</CardTitle>
            <Link href="/time-off">
              <Button variant="link" size="sm" className="h-auto p-0">
                Nuova Richiesta
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-4">
            {myTimeOffRequests.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                Nessuna richiesta effettuata
              </div>
            ) : (
              <div className="space-y-3">
                {myTimeOffRequests.slice(0, 3).map((request: any) => (
                  <div 
                    key={request.id}
                    className="border rounded-md p-3 flex justify-between items-center"
                  >
                    <div>
                      <div className="flex items-center">
                        <span className={`material-icons text-sm mr-2 ${
                          request.status === "approved" 
                            ? "text-success" 
                            : request.status === "rejected"
                            ? "text-error"
                            : "text-warning"
                        }`}>
                          {request.status === "approved" 
                            ? "check_circle" 
                            : request.status === "rejected"
                            ? "cancel"
                            : "pending"}
                        </span>
                        <p className="text-sm font-medium">
                          {request.type === "vacation" 
                            ? "Ferie" 
                            : request.type === "personal"
                            ? "Permesso Personale"
                            : "Cambio Turno"}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(request.startDate)} - {formatDate(request.endDate)}
                      </p>
                    </div>
                    <div className="text-xs">
                      <span className={`px-2 py-1 rounded-full ${
                        request.status === "approved" 
                          ? "bg-green-100 text-green-800" 
                          : request.status === "rejected"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {request.status === "approved" 
                          ? "Approvata" 
                          : request.status === "rejected"
                          ? "Rifiutata"
                          : "In attesa"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Latest Documents */}
        <Card>
          <CardHeader className="border-b px-4 py-3 flex justify-between items-center">
            <CardTitle className="text-base font-medium">Documenti Recenti</CardTitle>
            <Link href="/my-documents">
              <Button variant="link" size="sm" className="h-auto p-0">
                Vedi tutti
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-4">
            {myDocuments.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                Nessun documento disponibile
              </div>
            ) : (
              <div className="space-y-3">
                {latestPayslip && (
                  <div className="border rounded-md p-3 flex justify-between items-center">
                    <div className="flex items-center">
                      <div className="bg-red-100 p-1 rounded mr-3">
                        <span className="material-icons text-error">description</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          Busta Paga - {latestPayslip.period}
                        </p>
                        <p className="text-xs text-gray-500">
                          Caricato il {formatDate(latestPayslip.uploadedAt)}
                        </p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      className="flex items-center gap-1"
                      onClick={handleDownloadPayslip}
                    >
                      <span className="material-icons text-xs">download</span>
                      PDF
                    </Button>
                  </div>
                )}
                
                {latestTaxDoc && (
                  <div className="border rounded-md p-3 flex justify-between items-center">
                    <div className="flex items-center">
                      <div className="bg-blue-100 p-1 rounded mr-3">
                        <span className="material-icons text-primary">folder</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          CUD - {latestTaxDoc.period}
                        </p>
                        <p className="text-xs text-gray-500">
                          Caricato il {formatDate(latestTaxDoc.uploadedAt)}
                        </p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      className="flex items-center gap-1"
                      onClick={handleDownloadTaxDoc}
                    >
                      <span className="material-icons text-xs">download</span>
                      PDF
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
