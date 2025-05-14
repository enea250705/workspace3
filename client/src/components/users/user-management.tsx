import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { UserForm } from "./user-form";
import { BulkUsersForm } from "./bulk-users-form";
import { User } from "@shared/schema";
import { Loader2, Search, Edit, UserPlus, CheckCircle, XCircle, Upload, Users, MoreVertical, Key } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AnimatedContainer } from "@/components/ui/animated-container";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isNewUserDialogOpen, setIsNewUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [isBulkAddDialogOpen, setIsBulkAddDialogOpen] = useState(false);
  const [isChangePasswordDialogOpen, setIsChangePasswordDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const usersPerPage = 10;
  
  // Fetch all users
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async ({ queryKey }) => {
      const res = await fetch(queryKey[0] as string, {
        credentials: "include"
      });
      if (!res.ok) {
        throw new Error("Error fetching users");
      }
      return res.json();
    }
  });
  
  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: (userData: any) => 
      apiRequest("PATCH", `/api/users/${userData.id}`, userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsEditUserDialogOpen(false);
      toast({
        title: "Utente aggiornato",
        description: "L'utente è stato aggiornato con successo.",
      });
    },
    onError: (error) => {
      console.error("Failed to update user:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'aggiornamento dell'utente.",
        variant: "destructive",
      });
    }
  });
  
  // Toggle user active status
  const toggleUserStatus = (user: User) => {
    updateUserMutation.mutate({
      id: user.id,
      isActive: !user.isActive,
    });
  };
  
  // Filter users based on search and filters
  const filteredUsers = users
    .filter((user: User) => {
      const nameMatch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const roleMatch = roleFilter === "all" || user.role === roleFilter;
      const statusMatch = statusFilter === "all" || 
                         (statusFilter === "active" && user.isActive) ||
                         (statusFilter === "inactive" && !user.isActive);
      
      return nameMatch && roleMatch && statusMatch;
    })
    .sort((a: User, b: User) => a.name.localeCompare(b.name));
  
  // Paginate users
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * usersPerPage,
    currentPage * usersPerPage
  );
  
  // Handle edit user
  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setIsEditUserDialogOpen(true);
  };
  
  // Handle change password
  const handleChangePassword = (user: User) => {
    setSelectedUser(user);
    setNewPassword("");
    setIsChangePasswordDialogOpen(true);
  };
  
  // Password change mutation
  const changePasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: number, password: string }) => {
      const response = await apiRequest("PATCH", `/api/users/${userId}`, { password });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsChangePasswordDialogOpen(false);
      toast({
        title: "Password modificata",
        description: "La password dell'utente è stata modificata con successo.",
      });
    },
    onError: (error) => {
      console.error("Failed to change password:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la modifica della password.",
        variant: "destructive",
      });
    }
  });
  
  // Format last login date
  const formatLastLogin = (lastLogin: string | Date | null | undefined) => {
    if (!lastLogin) return "Mai";
    
    const date = typeof lastLogin === 'string' ? new Date(lastLogin) : lastLogin;
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return "Oggi, " + date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Ieri, " + date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays < 7) {
      return `${diffDays} giorni fa`;
    } else {
      return formatDate(date.toISOString());
    }
  };
  
  return (
    <AnimatedContainer>
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-3">
            <h2 className="text-xl font-bold">Gestione Utenti</h2>
            <div className="flex flex-wrap gap-2">
              <Dialog open={isBulkAddDialogOpen} onOpenChange={setIsBulkAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-1 text-xs sm:text-sm" variant="outline">
                    <Users className="h-4 w-4 mr-1 sm:mr-2" />
                    <span className="sm:inline hidden">Importa Multipli</span>
                    <span className="sm:hidden inline">Importa</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xl w-[92%] md:w-full" aria-describedby="bulk-users-description">
                  <DialogHeader>
                    <DialogTitle>Importa Utenti in Blocco</DialogTitle>
                    <DialogDescription id="bulk-users-description" className="sr-only">
                      Form per importare utenti in blocco
                    </DialogDescription>
                  </DialogHeader>
                  <BulkUsersForm 
                    onSubmit={(result) => {
                      setIsBulkAddDialogOpen(false);
                      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
                      toast({
                        title: "Utenti importati",
                        description: `${result.createdCount} utenti sono stati creati con successo.`,
                      });
                    }}
                    onCancel={() => setIsBulkAddDialogOpen(false)}
                  />
                </DialogContent>
              </Dialog>
              
              <Dialog open={isNewUserDialogOpen} onOpenChange={setIsNewUserDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-1 text-xs sm:text-sm">
                    <UserPlus className="h-4 w-4 mr-1 sm:mr-2" />
                    <span className="sm:inline hidden">Nuovo Utente</span>
                    <span className="sm:hidden inline">Nuovo</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md w-[92%] md:w-full" aria-describedby="new-user-description">
                  <DialogHeader>
                    <DialogTitle>Aggiungi Nuovo Utente</DialogTitle>
                    <DialogDescription id="new-user-description" className="sr-only">
                      Form per aggiungere un nuovo utente
                    </DialogDescription>
                  </DialogHeader>
                  <UserForm 
                    onSubmit={(userData) => {
                      setIsNewUserDialogOpen(false);
                      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
                      toast({
                        title: "Utente creato",
                        description: "Il nuovo utente è stato creato con successo.",
                      });
                    }}
                    onCancel={() => setIsNewUserDialogOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
          
          {/* Search & Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
            <div className="sm:col-span-1">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-2">
                  <Search className="h-4 w-4 text-gray-400" />
                </span>
                <Input
                  type="text"
                  placeholder="Cerca utenti..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>
            <div>
              <Select
                value={roleFilter}
                onValueChange={(value) => {
                  setRoleFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Tutti i ruoli" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="all">Tutti i ruoli</SelectItem>
                  <SelectItem value="admin">Amministratore</SelectItem>
                  <SelectItem value="employee">Dipendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Tutti gli stati" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="all">Tutti gli stati</SelectItem>
                  <SelectItem value="active">Attivo</SelectItem>
                  <SelectItem value="inactive">Disattivato</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Users Table/Cards */}
          {isLoading ? (
            <div className="py-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="mt-2 text-sm text-gray-500">Caricamento utenti...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-8 text-center">
              <XCircle className="h-12 w-12 mx-auto text-gray-400" />
              <p className="mt-2 text-gray-500">Nessun utente trovato</p>
            </div>
          ) : (
            <>
              {/* Desktop Table (Hidden on Mobile) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2 text-left">Nome</th>
                      <th className="px-4 py-2 text-left">Email</th>
                      <th className="px-4 py-2 text-left">Ruolo</th>
                      <th className="px-4 py-2 text-left">Stato</th>
                      <th className="px-4 py-2 text-left">Ultimo accesso</th>
                      <th className="px-4 py-2 text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {paginatedUsers.map((user: User) => (
                      <tr key={user.id}>
                        <td className="px-4 py-3">{user.name}</td>
                        <td className="px-4 py-3">{user.email}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            user.role === "admin" 
                              ? "bg-primary/10 text-primary" 
                              : "bg-gray-100 text-gray-600"
                          }`}>
                            {user.role === "admin" ? "Amministratore" : "Dipendente"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center">
                            <span className={`w-2 h-2 rounded-full ${
                              user.isActive ? "bg-green-500" : "bg-red-500"
                            } mr-1`}></span>
                            {user.isActive ? "Attivo" : "Disattivato"}
                          </span>
                        </td>
                        <td className="px-4 py-3">{formatLastLogin(user.lastLogin)}</td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEditUser(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleChangePassword(user)}
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => toggleUserStatus(user)}
                          >
                            {user.isActive ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards (Visible only on mobile) */}
              <div className="md:hidden space-y-3">
                {paginatedUsers.map((user: User) => (
                  <div key={user.id} className="bg-white border rounded-lg p-3 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-medium">{user.name}</h3>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditUser(user)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Modifica
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleChangePassword(user)}>
                            <Key className="h-4 w-4 mr-2" />
                            Cambia Password
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleUserStatus(user)}>
                            {user.isActive ? (
                              <>
                                <XCircle className="h-4 w-4 mr-2 text-red-500" />
                                Disattiva
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                                Attiva
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center mt-2 gap-2 flex-wrap">
                      <Badge variant={user.role === "admin" ? "default" : "secondary"} className="text-xs">
                        {user.role === "admin" ? "Amministratore" : "Dipendente"}
                      </Badge>
                      <Badge variant={user.isActive ? "outline" : "destructive"} className="text-xs">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          user.isActive ? "bg-green-500" : "bg-red-500"
                        } mr-1 inline-block`}></span>
                        {user.isActive ? "Attivo" : "Disattivato"}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Ultimo accesso: {formatLastLogin(user.lastLogin)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          
          {/* Pagination */}
          {filteredUsers.length > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="text-xs sm:text-sm text-gray-500 order-2 sm:order-1">
                Mostra {(currentPage - 1) * usersPerPage + 1}-{Math.min(currentPage * usersPerPage, filteredUsers.length)} di {filteredUsers.length} utenti
              </div>
              <div className="flex space-x-1 order-1 sm:order-2">
                <Button
                  variant={currentPage === 1 ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="text-xs"
                >
                  Precedente
                </Button>
                
                {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                  let pageNumber;
                  
                  if (totalPages <= 3) {
                    pageNumber = i + 1;
                  } else if (currentPage <= 2) {
                    pageNumber = i + 1;
                  } else if (currentPage >= totalPages - 1) {
                    pageNumber = totalPages - 2 + i;
                  } else {
                    pageNumber = currentPage - 1 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNumber}
                      variant={currentPage === pageNumber ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNumber)}
                      className="text-xs"
                    >
                      {pageNumber}
                    </Button>
                  );
                })}
                
                <Button
                  variant={currentPage === totalPages ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="text-xs"
                >
                  Successivo
                </Button>
              </div>
            </div>
          )}
          
          {/* Edit User Dialog */}
          <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
            <DialogContent className="sm:max-w-md w-[92%] md:w-full" aria-describedby="edit-user-description">
              <DialogHeader>
                <DialogTitle>Modifica Utente</DialogTitle>
                <DialogDescription id="edit-user-description" className="sr-only">
                  Form per modificare i dati dell'utente
                </DialogDescription>
              </DialogHeader>
              {selectedUser && (
                <UserForm 
                  user={selectedUser}
                  onSubmit={(userData) => {
                    updateUserMutation.mutate({
                      ...userData,
                      id: selectedUser.id,
                    });
                  }}
                  onCancel={() => setIsEditUserDialogOpen(false)}
                  isEdit={true}
                />
              )}
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </AnimatedContainer>
  );
}