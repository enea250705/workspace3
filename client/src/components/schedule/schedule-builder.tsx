import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parseISO, addDays } from "date-fns";
import { it } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { generateTimeSlots, formatHours } from "@/lib/utils";

type ScheduleBuilderProps = {
  scheduleId: number | null;
  users: any[];
  startDate: Date;
  endDate: Date;
  shifts: any[];
  isPublished: boolean;
  onPublish: () => void;
  onAutoGenerate: () => void;
  onExportPdf: () => void;
  onChangeWeek: () => void;
};

export function ScheduleBuilder({
  scheduleId,
  users,
  startDate,
  endDate,
  shifts,
  isPublished,
  onPublish,
  onAutoGenerate,
  onExportPdf,
  onChangeWeek,
}: ScheduleBuilderProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeDay, setActiveDay] = useState(0);
  const [gridData, setGridData] = useState<any>({});
  const timeSlots = generateTimeSlots(4, 24);
  
  // Initialize days of the week
  type WeekDay = {
    date: Date;
    name: string;
    shortName: string;
    dateStr: string;
  };
  
  const weekDays: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(startDate, i);
    weekDays.push({
      date,
      name: format(date, "EEEE", { locale: it }),
      shortName: format(date, "EEE", { locale: it }),
      dateStr: format(date, "yyyy-MM-dd")
    });
  }
  
  // Create shift mutation
  const createShiftMutation = useMutation({
    mutationFn: (shiftData: any) => 
      apiRequest("POST", "/api/shifts", shiftData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/schedules/${scheduleId}/shifts`] });
      toast({
        title: "Turno aggiornato",
        description: "Il turno è stato aggiornato con successo.",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'aggiornamento del turno.",
        variant: "destructive",
      });
    }
  });
  
  // Update shift mutation
  const updateShiftMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      apiRequest("PATCH", `/api/shifts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/schedules/${scheduleId}/shifts`] });
      toast({
        title: "Turno aggiornato",
        description: "Il turno è stato aggiornato con successo.",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'aggiornamento del turno.",
        variant: "destructive",
      });
    }
  });
  
  // Delete shift mutation
  const deleteShiftMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest("DELETE", `/api/shifts/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/schedules/${scheduleId}/shifts`] });
      toast({
        title: "Turno eliminato",
        description: "Il turno è stato eliminato con successo.",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'eliminazione del turno.",
        variant: "destructive",
      });
    }
  });
  
  // Fetch approved time-off requests
  const { data: timeOffRequests = [] } = useQuery({
    queryKey: ["/api/time-off-requests"],
    select: (data: any) => data.filter((req: any) => req.status === "approved"),
  });

  // Evitiamo re-render non necessari
  const isFirstRender = React.useRef(true);
  
  // Initialize grid data based on shifts and time-off requests
  // Effetto per inizializzare i dati della griglia
  // Usiamo useEffect separati per evitare loop infiniti
  useEffect(() => {
    if (!shifts || !users || !scheduleId) return;
    
    // Controlliamo se è la prima renderizzazione o se ci sono nuovi turni
    if (isFirstRender.current || Object.keys(gridData).length === 0) {
      console.log("Rendering grid data with shifts:", shifts.length);
      isFirstRender.current = false;
      
      const newGridData: any = {};
    
      // Initialize empty grid for all users and time slots
      weekDays.forEach(day => {
        newGridData[day.name] = {};
        users.forEach(user => {
          newGridData[day.name][user.id] = {
            cells: timeSlots.map(() => ({ type: "", shiftId: null })),
            notes: "",
            total: 0
          };
        });
      });
      
      // Fill grid with existing shifts
      shifts.forEach(shift => {
        const userId = shift.userId;
        const day = shift.day;
        
        if (newGridData[day] && newGridData[day][userId]) {
          // Find the indices corresponding to the shift's time range
          const startIndex = timeSlots.indexOf(shift.startTime);
          const endIndex = timeSlots.indexOf(shift.endTime);
          
          if (startIndex >= 0 && endIndex >= 0) {
            for (let i = startIndex; i < endIndex; i++) {
              newGridData[day][userId].cells[i] = { 
                type: shift.type, 
                shiftId: shift.id 
              };
            }
            
            // Update notes and calculate total hours
            newGridData[day][userId].notes = shift.notes || "";
            
            const startTime = shift.startTime.split(':').map(Number);
            const endTime = shift.endTime.split(':').map(Number);
            
            let hours = endTime[0] - startTime[0];
            let minutes = endTime[1] - startTime[1];
            
            if (minutes < 0) {
              hours -= 1;
              minutes += 60;
            }
            
            newGridData[day][userId].total = hours + (minutes / 60);
          }
        }
      });
      
      setGridData(newGridData);
    }
  }, [shifts, users, scheduleId, weekDays, timeSlots, gridData]);
    
  // Add approved time-off requests to the grid in a separate useEffect
  useEffect(() => {
    if (!timeOffRequests || timeOffRequests.length === 0 || !gridData || Object.keys(gridData).length === 0) return;
    
    // Make a deep copy of gridData to prevent issues
    const newGridData = JSON.parse(JSON.stringify(gridData));
    let hasChanges = false;
    
    timeOffRequests.forEach((request: any) => {
      const userId = request.userId;
      const startDate = new Date(request.startDate);
      const endDate = new Date(request.endDate);
      
      // Check each day in the week to see if it falls within the time-off period
      weekDays.forEach(day => {
        const dayDate = new Date(day.dateStr);
        if (dayDate >= startDate && dayDate <= endDate) {
          if (newGridData[day.name] && newGridData[day.name][userId]) {
            hasChanges = true;
            // Mark all cells for this day as time-off
            // For full day, mark all cells; for half day, mark morning or afternoon
            if (request.duration === "full_day") {
              newGridData[day.name][userId].cells = newGridData[day.name][userId].cells.map(() => ({
                type: request.type === "vacation" ? "vacation" : "leave",
                isTimeOff: true,
                requestId: request.id
              }));
              newGridData[day.name][userId].notes = `${request.type === "vacation" ? "Ferie" : "Permesso"} approvato`;
            } else if (request.duration === "morning") {
              // Mark first half of the day
              const halfDay = Math.floor(timeSlots.length / 2);
              for (let i = 0; i < halfDay; i++) {
                newGridData[day.name][userId].cells[i] = {
                  type: request.type === "vacation" ? "vacation" : "leave",
                  isTimeOff: true,
                  requestId: request.id
                };
              }
              newGridData[day.name][userId].notes = `${request.type === "vacation" ? "Ferie" : "Permesso"} mattina`;
            } else if (request.duration === "afternoon") {
              // Mark second half of the day
              const halfDay = Math.floor(timeSlots.length / 2);
              for (let i = halfDay; i < timeSlots.length; i++) {
                newGridData[day.name][userId].cells[i] = {
                  type: request.type === "vacation" ? "vacation" : "leave",
                  isTimeOff: true,
                  requestId: request.id
                };
              }
              newGridData[day.name][userId].notes = `${request.type === "vacation" ? "Ferie" : "Permesso"} pomeriggio`;
            }
          }
        }
      });
    });
    
    // Only update if there were actual changes
    if (hasChanges) {
      setGridData(newGridData);
    }
  }, [timeOffRequests, gridData, weekDays, timeSlots]);
  
  // Handle cell click to toggle shift status
  const handleCellClick = (userId: number, timeIndex: number, day: string) => {
    if (!scheduleId) return;
    
    const newGridData = { ...gridData };
    const userDayData = newGridData[day][userId];
    const currentCell = userDayData.cells[timeIndex];
    
    // Toggle cell type in cycle: empty -> work -> vacation -> leave -> empty
    let newType = "";
    
    if (currentCell.type === "") {
      newType = "work";
    } else if (currentCell.type === "work") {
      newType = "vacation";
    } else if (currentCell.type === "vacation") {
      newType = "leave";
    } else if (currentCell.type === "leave") {
      // Se è già "leave", torniamo a cella vuota
      newType = "";
    }
    
    // Find consecutive cells of the same type (if any)
    let startIndex = timeIndex;
    let endIndex = timeIndex;
    
    if (currentCell.shiftId) {
      // If clicking on existing shift, find its boundaries
      const cellType = currentCell.type;
      
      // Find start index of the shift
      for (let i = timeIndex; i >= 0; i--) {
        if (userDayData.cells[i].shiftId === currentCell.shiftId) {
          startIndex = i;
        } else {
          break;
        }
      }
      
      // Find end index of the shift
      for (let i = timeIndex; i < userDayData.cells.length; i++) {
        if (userDayData.cells[i].shiftId === currentCell.shiftId) {
          endIndex = i;
        } else {
          break;
        }
      }
      
      // Update all cells in the range
      for (let i = startIndex; i <= endIndex; i++) {
        userDayData.cells[i] = { type: "", shiftId: null };
      }
      
      // Delete the shift from the server
      deleteShiftMutation.mutate(currentCell.shiftId);
      
      // Reset total hours
      userDayData.total = 0;
    } else if (newType !== "") {
      // Creating a new shift
      // Create new shift with selected time slot
      const newShiftData = {
        scheduleId,
        userId,
        day,
        startTime: timeSlots[timeIndex],
        endTime: timeSlots[timeIndex + 1],  // Ora usiamo l'indice + 1 per creare uno slot di 30 minuti
        type: newType,
        notes: userDayData.notes,
        area: ""
      };
      
      // Mostra toast di conferma quando si crea un nuovo turno
      toast({
        title: "Turno aggiunto",
        description: `Nuovo turno ${newType === "work" ? "di lavoro" : newType === "vacation" ? "di ferie" : "di permesso"} aggiunto per ${day}`,
      });
      
      createShiftMutation.mutate(newShiftData);
    }
    
    setGridData(newGridData);
  };
  
  // Handle notes update
  const handleNotesChange = (userId: number, day: string, notes: string) => {
    if (!scheduleId || isPublished) return;
    
    const newGridData = { ...gridData };
    newGridData[day][userId].notes = notes;
    
    // Find shift for this user and day to update notes
    const userShifts = shifts.filter(s => s.userId === userId && s.day === day);
    
    if (userShifts.length > 0) {
      const shiftToUpdate = userShifts[0];
      updateShiftMutation.mutate({
        id: shiftToUpdate.id,
        data: { notes }
      });
    }
    
    setGridData(newGridData);
  };
  
  // Copy day schedule to next day
  const handleCopyDay = () => {
    if (!scheduleId || isPublished) return;
    
    const currentDay = weekDays[activeDay].name;
    const nextDay = weekDays[(activeDay + 1) % 7].name;
    
    // Copy all shifts from current day to next day
    Object.entries(gridData[currentDay]).forEach(([userId, userData]: [string, any]) => {
      const userIdNum = parseInt(userId);
      
      // Find continuous blocks of cells with the same type
      let currentBlock: { start: number; end: number; type: string } | null = null;
      
      userData.cells.forEach((cell: any, index: number) => {
        if (cell.type !== "") {
          if (!currentBlock || currentBlock.type !== cell.type) {
            // If we had a previous block, save it
            if (currentBlock) {
              createShiftMutation.mutate({
                scheduleId,
                userId: userIdNum,
                day: nextDay,
                startTime: timeSlots[currentBlock.start],
                endTime: timeSlots[currentBlock.end],  // Rimuovo il +1 per evitare di aggiungere 30 minuti in più
                type: currentBlock.type,
                notes: userData.notes,
                area: ""
              });
            }
            // Start a new block
            currentBlock = { start: index, end: index, type: cell.type };
          } else {
            // Extend the current block
            currentBlock.end = index;
          }
        } else if (currentBlock) {
          // End of a block
          createShiftMutation.mutate({
            scheduleId,
            userId: userIdNum,
            day: nextDay,
            startTime: timeSlots[currentBlock.start],
            endTime: timeSlots[currentBlock.end],  // Rimuovo il +1 per evitare di aggiungere 30 minuti in più
            type: currentBlock.type,
            notes: userData.notes,
            area: ""
          });
          currentBlock = null;
        }
      });
      
      // Don't forget the last block if it extends to the end
      if (currentBlock) {
        createShiftMutation.mutate({
          scheduleId,
          userId: userIdNum,
          day: nextDay,
          startTime: timeSlots[currentBlock.start],
          endTime: timeSlots[currentBlock.end],  // Rimuovo il +1 per evitare di aggiungere 30 minuti in più
          type: currentBlock.type,
          notes: userData.notes,
          area: ""
        });
      }
    });
    
    toast({
      title: "Giorno copiato",
      description: `Gli orari di ${currentDay} sono stati copiati in ${nextDay}.`,
    });
  };
  
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-condensed font-medium">Pianificazione Turni</h2>
            <p className="text-sm text-gray-500">
              Settimana: {format(startDate, "d MMMM", { locale: it })} - {format(endDate, "d MMMM yyyy", { locale: it })}
            </p>
          </div>
          <div className="flex space-x-3">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
              onClick={onChangeWeek}
            >
              <span className="material-icons text-sm">calendar_today</span>
              Cambia Settimana
            </Button>
            <Button
              variant="default"
              size="sm"
              className="flex items-center gap-1"
              onClick={onAutoGenerate}
              disabled={isPublished}
            >
              <span className="material-icons text-sm">schedule</span>
              Auto-genera
            </Button>
            <Button
              variant="default"
              size="sm"
              className="flex items-center gap-1 bg-success hover:bg-success/90"
              onClick={onPublish}
              disabled={isPublished}
            >
              <span className="material-icons text-sm">publish</span>
              Pubblica
            </Button>
          </div>
        </div>
        
        {/* Color Legend */}
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-100 mr-1"></div>
            <span className="text-xs">In servizio</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-red-100 mr-1"></div>
            <span className="text-xs">Ferie</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-yellow-100 mr-1"></div>
            <span className="text-xs">Permesso</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-white border border-gray-300 mr-1"></div>
            <span className="text-xs">Non in servizio</span>
          </div>
        </div>
        
        {/* Day Tabs */}
        <Tabs 
          defaultValue={weekDays[0].name} 
          onValueChange={(value) => {
            const index = weekDays.findIndex(day => day.name === value);
            setActiveDay(index);
          }}
        >
          <TabsList className="mb-4 w-full border-b">
            {weekDays.map((day, index) => (
              <TabsTrigger 
                key={day.name}
                value={day.name}
                className="px-4 py-2 flex-1"
              >
                {day.shortName}
              </TabsTrigger>
            ))}
          </TabsList>
          
          {weekDays.map((day) => (
            <TabsContent key={day.name} value={day.name}>
              <div className="overflow-x-auto pb-4">
                <table className="schedule-grid text-xs">
                  <thead>
                    <tr>
                      <th className="name-cell">Dipendente</th>
                      {timeSlots.map((slot) => (
                        <th key={slot}>{slot}</th>
                      ))}
                      <th className="notes-cell">Note</th>
                      <th className="total-cell">Totale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users
                      .filter(user => user.role === "employee" && user.isActive)
                      .map((user) => (
                        <tr key={user.id}>
                          <td className="name-cell">{user.name}</td>
                          {gridData[day.name] && 
                            gridData[day.name][user.id] &&
                            gridData[day.name][user.id].cells.map((cell: any, index: number) => (
                              <td 
                                key={index}
                                className={
                                  cell.type === "work" 
                                    ? "working" 
                                    : cell.type === "vacation" 
                                    ? "vacation" 
                                    : cell.type === "leave" 
                                    ? "leave" 
                                    : ""
                                }
                                onClick={() => !isPublished && handleCellClick(user.id, index, day.name)}
                                style={{ cursor: isPublished ? "default" : "pointer" }}
                              >
                                {cell.type === "work" && "X"}
                                {cell.type === "vacation" && "F"}
                                {cell.type === "leave" && "P"}
                              </td>
                            ))}
                          <td className="notes-cell">
                            <input
                              type="text"
                              className="w-full h-full border-none text-xs px-1"
                              value={(gridData[day.name] && gridData[day.name][user.id]) ? gridData[day.name][user.id].notes : ""}
                              onChange={(e) => handleNotesChange(user.id, day.name, e.target.value)}
                              disabled={isPublished}
                              placeholder="Note..."
                            />
                          </td>
                          <td className="total-cell">
                            {(gridData[day.name] && gridData[day.name][user.id]) ? 
                              formatHours(gridData[day.name][user.id].total) : 
                              "0h"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          ))}
        </Tabs>
        
        <div className="flex justify-between mt-4">
          <div>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
              onClick={handleCopyDay}
              disabled={isPublished}
            >
              <span className="material-icons text-sm">content_copy</span>
              Copia Giorno
            </Button>
          </div>
          <div>
            <Button
              variant="default"
              size="sm"
              className="flex items-center gap-1"
              onClick={onPublish}
            >
              <span className="material-icons text-sm">publish</span>
              Pubblica
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1 ml-2"
              onClick={onExportPdf}
            >
              <span className="material-icons text-sm">download</span>
              PDF
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
