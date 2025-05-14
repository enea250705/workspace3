import React from "react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface WeekSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedules: any[];
  onSelectSchedule: (scheduleId: number) => void;
}

export function WeekSelectorDialog({
  open,
  onOpenChange,
  schedules,
  onSelectSchedule,
}: WeekSelectorDialogProps) {
  // Ordina i programmi dal più recente al più vecchio
  const sortedSchedules = [...schedules].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    
    return `${format(start, "d MMMM", { locale: it })} - ${format(end, "d MMMM yyyy", { locale: it })}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95%] max-w-md p-4 sm:p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-center sm:text-left">Seleziona Settimana</DialogTitle>
          <p className="text-xs text-center sm:text-left text-muted-foreground pt-2">
            Seleziona la settimana di turni da visualizzare
          </p>
        </DialogHeader>
        <div className="max-h-[60vh] sm:max-h-[400px] mt-2 sm:mt-4 overflow-y-auto pr-1">
          <div className="space-y-2">
            {sortedSchedules.length > 0 ? (
              sortedSchedules.map((schedule) => (
                <Button
                  key={schedule.id}
                  variant={schedule.isPublished ? "default" : "outline"}
                  className="w-full justify-between p-3 sm:px-4 h-auto min-h-[3rem]"
                  onClick={() => onSelectSchedule(schedule.id)}
                >
                  <div className="flex flex-col items-start">
                    <span className="text-xs sm:text-sm font-medium">
                      {formatDateRange(schedule.startDate, schedule.endDate)}
                    </span>
                    <span className="text-[10px] sm:text-xs text-muted-foreground">
                      {schedule.isPublished 
                        ? `Pubblicato ${format(new Date(schedule.publishedAt), "d/MM", { locale: it })}` 
                        : "Non pubblicato"}
                    </span>
                  </div>
                  <span className="material-icons text-base sm:text-lg">
                    {schedule.isPublished ? "check_circle" : "pending"}
                  </span>
                </Button>
              ))
            ) : (
              <div className="text-center p-4 text-muted-foreground">
                Nessuna pianificazione disponibile
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}