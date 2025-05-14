import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, calculateTotalWorkHours } from "@/lib/utils";
import { Link } from "wouter";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { apiRequest } from "@/lib/queryClient";
import { RecentActivities } from "./recent-activities";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

// Define interfaces for our data types
interface User {
  id: number;
  name: string;
  isActive: boolean;
  role: string;
  email?: string;
}

interface TimeOffRequest {
  id: number;
  userId: number;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

interface Schedule {
  id: number;
  startDate: string;
  endDate: string;
  isPublished: boolean;
}

interface Shift {
  id: number;
  userId: number;
  employeeId?: number;
  scheduleId: number;
  day: string;
  date?: string;
  startTime: string;
  endTime: string;
  type: string;
  notes?: string;
  area?: string;
}

export function AdminDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: timeOffRequests = [] } = useQuery<TimeOffRequest[]>({
    queryKey: ["/api/time-off-requests"],
  });

  const { data: pendingRequests = [] } = useQuery<TimeOffRequest[]>({
    queryKey: ["/api/time-off-requests/pending"],
  });

  const { data: currentSchedule } = useQuery<Schedule | null>({
    queryKey: ["/api/schedules"],
  });
  
  const { data: allShifts = [] } = useQuery<Shift[]>({
    queryKey: [`/api/schedules/${currentSchedule?.id}/shifts`],
    enabled: !!currentSchedule?.id,
  });

  // Mutations for approving/rejecting requests
  const approveMutation = useMutation({
    mutationFn: (requestId: number) =>
      apiRequest("POST", `/api/time-off-requests/${requestId}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-off-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-off-requests/pending"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (requestId: number) =>
      apiRequest("POST", `/api/time-off-requests/${requestId}/reject`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-off-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-off-requests/pending"] });
    },
  });

  // Calcola le date della settimana corrente
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Lunedì
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() - today.getDay() + 7); // Domenica
  
  // Current stats
  const activeEmployees = users.filter((user) => user.isActive).length;
  
  // Conta i dipendenti in ferie nella settimana corrente
  const employeesOnVacation = timeOffRequests
    .filter((req) => {
      // Verifica che sia approvata e sia di tipo vacanza
      if (req.status !== "approved" || req.type !== "vacation") return false;
      
      const startDate = new Date(req.startDate);
      const endDate = new Date(req.endDate);
      
      // Verifica se la richiesta di ferie si sovrappone alla settimana corrente
      return (
        (startDate <= endOfWeek && endDate >= startOfWeek) || 
        (endDate >= startOfWeek && startDate <= endOfWeek)
      );
    })
    .reduce((acc: Set<number>, req: TimeOffRequest) => {
      // Usa un Set per evitare di contare più volte lo stesso dipendente
      acc.add(req.userId);
      return acc;
    }, new Set<number>()).size;

  // Calcola le ore totali per fasce orarie
  const shiftDistributionData = (() => {
    if (!allShifts || !Array.isArray(allShifts) || allShifts.length === 0) {
      return [
        { name: "Mattina", hours: 0 },
        { name: "Pomeriggio", hours: 0 },
        { name: "Sera", hours: 0 },
      ];
    }
    
    // Conta le ore per fasce orarie
    const morningHours = calculateTotalWorkHours(
      allShifts.filter((shift) => 
        shift.type === "work" && 
        shift.startTime >= "04:00" && 
        shift.startTime < "12:00"
      )
    );
    
    const afternoonHours = calculateTotalWorkHours(
      allShifts.filter((shift) => 
        shift.type === "work" && 
        shift.startTime >= "12:00" && 
        shift.startTime < "18:00"
      )
    );
    
    const eveningHours = calculateTotalWorkHours(
      allShifts.filter((shift) => 
        shift.type === "work" && 
        shift.startTime >= "18:00"
      )
    );
    
    return [
      { name: "Mattina", hours: Math.round(morningHours) },
      { name: "Pomeriggio", hours: Math.round(afternoonHours) },
      { name: "Sera", hours: Math.round(eveningHours) },
    ];
  })();

  // Funzioni di utilità rimosse perché ora gestite dal componente RecentActivities

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm">Dipendenti Attivi</p>
                <p className="text-2xl font-medium">{activeEmployees}</p>
              </div>
              <div className="bg-blue-100 p-2 rounded-lg">
                <span className="material-icons text-primary">people</span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm">Richieste in Attesa</p>
                <p className="text-2xl font-medium">{pendingRequests.length}</p>
              </div>
              <div className="bg-red-100 p-2 rounded-lg">
                <span className="material-icons text-error">pending_actions</span>
              </div>
            </div>
            <div className="mt-4 text-xs flex items-center text-error">
              {pendingRequests.length > 0 ? (
                <>
                  <span className="material-icons text-xs mr-1">priority_high</span>
                  Richiesta urgente da approvare
                </>
              ) : (
                "Nessuna richiesta in attesa"
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm">Ore Programmate</p>
                <p className="text-2xl font-medium">{
                  calculateTotalWorkHours(
                    allShifts.filter((shift) => shift.type === "work")
                  ).toFixed(0)
                }</p>
              </div>
              <div className="bg-green-100 p-2 rounded-lg">
                <span className="material-icons text-success">schedule</span>
              </div>
            </div>
            <div className="mt-4 text-xs text-gray-500">
              Per questa settimana
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm">Dipendenti in Ferie</p>
                <p className="text-2xl font-medium">{employeesOnVacation}</p>
              </div>
              <div className="bg-amber-100 p-2 rounded-lg">
                <span className="material-icons text-warning">beach_access</span>
              </div>
            </div>
            <div className="mt-4 text-xs text-gray-500">
              Questa settimana
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Recent Activity */}
      <RecentActivities />
      
      {/* Single column layout for Pending Approvals only */}
      <div className="grid grid-cols-1 gap-4">
        {/* Pending Approvals */}
        <Card>
          <CardHeader className="border-b px-4 py-3 flex justify-between items-center">
            <CardTitle className="text-base font-medium">Richieste in Attesa</CardTitle>
            <Link href="/requests">
              <Button variant="link" size="sm" className="h-auto p-0">
                Gestisci
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-4">
            {pendingRequests.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                Nessuna richiesta in attesa di approvazione
              </div>
            ) : (
              <div className="divide-y">
                {pendingRequests.slice(0, 3).map((request) => (
                  <div key={request.id} className="py-3">
                    <div className="flex justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {request.type === "vacation"
                            ? "Richiesta Ferie"
                            : request.type === "personal"
                            ? "Permesso Personale"
                            : "Cambio Turno"}
                        </p>
                        <p className="text-xs text-gray-500">
                          Da:{" "}
                          <span className="font-medium">
                            {users.find((u) => u.id === request.userId)?.name || "Dipendente"}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500">
                          Periodo: {formatDate(request.startDate)} - {formatDate(request.endDate)}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="icon"
                          variant="default"
                          className="h-6 w-6 bg-success"
                          onClick={() => approveMutation.mutate(request.id)}
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                        >
                          <span className="material-icons text-sm">check</span>
                        </Button>
                        <Button
                          size="icon"
                          variant="default"
                          className="h-6 w-6 bg-error"
                          onClick={() => rejectMutation.mutate(request.id)}
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                        >
                          <span className="material-icons text-sm">close</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
