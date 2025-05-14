import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MobileNav } from "@/components/ui/mobile-nav";

type Notification = {
  id: number;
  userId: number;
  type: string;
  message: string;
  isRead: boolean;
  data: any;
  createdAt: string;
};

export function NotificationBar() {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const toggleMobileMenu = () => {
    // Trova il componente Sidebar e aggiorna il suo stato
    const event = new CustomEvent('toggle-mobile-menu');
    window.dispatchEvent(event);
  };
  
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: isAuthenticated,
  });
  
  const unreadCount = notifications.filter(n => !n.isRead).length;
  
  const getRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return "Adesso";
    if (diffMins < 60) return `${diffMins} minuti fa`;
    if (diffHours < 24) return `${diffHours} ore fa`;
    if (diffDays === 1) return "Ieri";
    return `${diffDays} giorni fa`;
  };
  
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "schedule_update":
        return { icon: "schedule", bgColor: "bg-blue-100", textColor: "text-primary" };
      case "request_approved":
        return { icon: "check_circle", bgColor: "bg-green-100", textColor: "text-success" };
      case "request_rejected":
        return { icon: "cancel", bgColor: "bg-red-100", textColor: "text-error" };
      case "document_upload":
        return { icon: "description", bgColor: "bg-purple-100", textColor: "text-purple-600" };
      case "time_off_request":
        return { icon: "pending_actions", bgColor: "bg-amber-100", textColor: "text-amber-600" };
      case "shift_update":
        return { icon: "event_available", bgColor: "bg-blue-100", textColor: "text-primary" };
      default:
        return { icon: "notifications", bgColor: "bg-gray-100", textColor: "text-gray-600" };
    }
  };
  
  const handleNotificationClick = async (notification: Notification) => {
    // Mark notification as read
    if (!notification.isRead) {
      await apiRequest(
        "POST", 
        `/api/notifications/${notification.id}/mark-read`, 
        {}
      );
      
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    }
    
    // Navigate based on notification type
    if (notification.type === "schedule_update" || notification.type === "shift_update") {
      setLocation(user?.role === "admin" ? "/schedule" : "/my-schedule");
    } else if (notification.type === "time_off_request" || 
              notification.type === "request_approved" || 
              notification.type === "request_rejected") {
      setLocation(user?.role === "admin" ? "/requests" : "/time-off");
    } else if (notification.type === "document_upload") {
      setLocation(user?.role === "admin" ? "/documents" : "/my-documents");
    }
    
    setIsNotificationsOpen(false);
  };
  
  const markAllAsRead = async () => {
    await apiRequest("POST", "/api/notifications/mark-all-read", {});
    queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    setIsNotificationsOpen(false);
  };
  
  return (
    <div 
      className="bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-10"
    >
      <div className="flex items-center">
        <MobileNav isMobileMenuOpen={mobileMenuOpen} toggleMobileMenu={toggleMobileMenu} />
        
        <h2 className="font-condensed text-xl ml-2 md:ml-0">
          {location === "/" || location === "/dashboard" 
            ? "Dashboard" 
            : location === "/users" 
            ? "Gestione Utenti"
            : location === "/schedule"
            ? "Pianificazione Turni"
            : location === "/requests"
            ? "Approvazioni"
            : location === "/documents"
            ? "Documenti"
            : location === "/my-schedule"
            ? "I Miei Turni"
            : location === "/time-off"
            ? "Ferie e Permessi"
            : location === "/my-documents"
            ? "I Miei Documenti"
            : "StaffSync"}
        </h2>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="relative">
          <button 
            className="p-1.5 rounded-full hover:bg-gray-100 relative"
            onClick={() => setIsNotificationsOpen(true)}
            aria-label="Notifiche"
          >
            <span className="material-icons">notifications</span>
            {unreadCount > 0 && (
              <span 
                className="absolute top-0 right-0 h-5 w-5 bg-primary text-white text-xs rounded-full flex items-center justify-center"
              >
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>
      
      <Dialog open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Notifiche</DialogTitle>
            <DialogClose />
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto">
            <div className="divide-y">
              {notifications.length === 0 ? (
                <div className="py-4 text-center text-gray-500">
                  Nessuna notifica
                </div>
              ) : (
                notifications.map(notification => {
                  const { icon, bgColor, textColor } = getNotificationIcon(notification.type);
                  return (
                    <div 
                      key={notification.id} 
                      className={cn(
                        "py-3 flex cursor-pointer hover:bg-gray-50",
                        !notification.isRead && "bg-blue-50/30"
                      )}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className={cn("p-1 rounded mr-3", bgColor)}>
                        <span className={cn("material-icons text-sm", textColor)}>{icon}</span>
                      </div>
                      <div>
                        <p className="text-sm">{notification.message}</p>
                        <p className="text-xs text-gray-500">{getRelativeTime(notification.createdAt)}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          {notifications.length > 0 && (
            <div className="mt-3 text-center">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={markAllAsRead}
                className="text-primary text-sm font-medium"
              >
                Segna tutte come lette
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}