import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { it } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

interface Activity {
  id: number;
  type: string;
  title: string;
  details?: string;
  timestamp: Date;
  icon: string;
}

export function RecentActivities() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [showAll, setShowAll] = useState(false);
  const maxActivities = showAll ? 50 : 4;
  
  // Carica i dati per le attività
  const { data: schedules = [] } = useQuery({
    queryKey: ["/api/schedules/all"],
    enabled: isAdmin,
  });
  
  const { data: timeOffRequests = [] } = useQuery({
    queryKey: ["/api/time-off-requests"],
  });
  
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    enabled: isAdmin,
  });
  
  const { data: documents = [] } = useQuery({
    queryKey: ["/api/documents"],
  });
  
  // Funzione per formattare la data
  const formatTimestamp = (date: Date) => {
    if (isToday(date)) {
      return "Oggi";
    } else if (isYesterday(date)) {
      return "Ieri";
    } else {
      return formatDistanceToNow(date, { locale: it, addSuffix: true });
    }
  };
  
  // Funzione per ottenere il nome di un utente
  const getUserName = (userId: number) => {
    const user = users.find((u: any) => u.id === userId);
    return user ? user.name : `Utente ${userId}`;
  };
  
  // Genera la lista delle attività
  const activities = useMemo(() => {
    const result: Activity[] = [];
    
    // Schedules pubblicati
    schedules.filter((s: any) => s.isPublished).forEach((schedule: any) => {
      const startDateFormatted = format(new Date(schedule.startDate), "d MMMM", { locale: it });
      const endDateFormatted = format(new Date(schedule.endDate), "d MMMM", { locale: it });
      
      result.push({
        id: result.length + 1,
        type: "schedule_published",
        title: "Turno settimanale pubblicato",
        details: `${startDateFormatted} - ${endDateFormatted}`,
        timestamp: new Date(schedule.publishedAt),
        icon: "event_available"
      });
    });
    
    // Richieste approvate/rifiutate
    timeOffRequests
      .filter((r: any) => r.status !== "pending" && r.approvedBy)
      .forEach((request: any) => {
        const isApproved = request.status === "approved";
        const userName = getUserName(request.userId);
        const startDateFormatted = format(new Date(request.startDate), "d MMMM", { locale: it });
        
        result.push({
          id: result.length + 1,
          type: isApproved ? "request_approved" : "request_rejected",
          title: isApproved 
            ? `Approvata richiesta${request.type === "vacation" ? " ferie" : ""} ${userName}`
            : `Rifiutata richiesta${request.type === "vacation" ? " ferie" : ""} ${userName}`,
          details: `Periodo: ${startDateFormatted}${request.startDate !== request.endDate ? 
            ` - ${format(new Date(request.endDate), "d MMMM", { locale: it })}` : ""
          }`,
          timestamp: new Date(request.updatedAt),
          icon: isApproved ? "check_circle" : "cancel"
        });
      });
    
    // Nuovi utenti
    if (isAdmin) {
      users.forEach((user: any) => {
        // Considera solo utenti registrati recentemente (negli ultimi 30 giorni)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const creationDate = new Date(user.lastLogin);
        if (creationDate > thirtyDaysAgo) {
          result.push({
            id: result.length + 1,
            type: "user_registered",
            title: `Nuovo dipendente registrato ${user.name}`,
            timestamp: creationDate,
            icon: "person_add"
          });
        }
      });
    }
    
    // Documenti caricati
    if (isAdmin) {
      // Raggruppa documenti caricati lo stesso giorno
      const documentsByDay = documents.reduce((acc: any, doc: any) => {
        const date = new Date(doc.uploadedAt).toDateString();
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(doc);
        return acc;
      }, {});
      
      Object.entries(documentsByDay).forEach(([date, docs]: [string, any]) => {
        let details = "";
        const typeMap: Record<string, number> = {};
        
        docs.forEach((doc: any) => {
          const type = doc.type === "payslip" ? "busta paga" : "CUD";
          typeMap[type] = (typeMap[type] || 0) + 1;
        });
        
        Object.entries(typeMap).forEach(([type, count]) => {
          details += `${count} ${type}${count > 1 ? "e" : ""}`;
          if (Object.keys(typeMap).length > 1) {
            details += ", ";
          }
        });
        
        result.push({
          id: result.length + 1,
          type: "documents_uploaded",
          title: "Documenti caricati nel sistema",
          details: details.trimEnd(),
          timestamp: new Date(docs[0].uploadedAt),
          icon: "upload_file"
        });
      });
    }
    
    // Ordina per data (più recenti prima)
    return result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [schedules, timeOffRequests, users, documents, isAdmin]);
  
  // Filtra solo le attività pertinenti in base al ruolo
  const filteredActivities = useMemo(() => {
    if (!isAdmin) {
      return activities.filter(activity => 
        ["schedule_published", "request_approved", "request_rejected"].includes(activity.type)
      );
    }
    return activities;
  }, [activities, isAdmin]);
  
  return (
    <Card className="bg-white h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium">Attività Recenti</CardTitle>
        {filteredActivities.length > 4 && (
          <Button
            variant="ghost"
            className="text-sm font-medium text-primary h-auto p-0"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Nascondi" : "Vedi tutte"}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {filteredActivities.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <span className="material-icons text-4xl mb-2">event_busy</span>
            <p>Nessuna attività recente</p>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredActivities.slice(0, maxActivities).map((activity) => (
              <div key={activity.id} className="flex items-start">
                <div className="flex-shrink-0 mt-1">
                  <span className="material-icons">{activity.icon}</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                  {activity.details && (
                    <p className="text-xs text-gray-600 mt-0.5">{activity.details}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {formatTimestamp(activity.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}