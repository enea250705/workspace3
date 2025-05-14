import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { insertUserSchema, User } from "@shared/schema";
import { Eye, EyeOff } from "lucide-react";

// Form schema - estendere lo schema esistente con validazione aggiuntiva
const userFormSchema = z.object({
  name: z.string().min(2, { message: "Il nome deve contenere almeno 2 caratteri" }),
  email: z.string().email({ message: "Email non valida" }),
  username: z.string().min(3, { message: "L'username deve contenere almeno 3 caratteri" }),
  password: z.string().min(6, { message: "La password deve contenere almeno 6 caratteri" }).optional(),
  role: z.enum(["admin", "employee"], {
    required_error: "Seleziona un ruolo",
  }),
  position: z.string().optional(),
  phone: z.string().optional(),
  isActive: z.boolean().default(true),
});

type UserFormValues = z.infer<typeof userFormSchema>;

type UserFormProps = {
  user?: User;
  onSubmit: (data: UserFormValues) => void;
  onCancel: () => void;
  isEdit?: boolean;
};

export function UserForm({ user, onSubmit, onCancel, isEdit = false }: UserFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  
  // Initialize form with default values or user data
  const form = useForm<UserFormValues>({
    resolver: zodResolver(
      isEdit 
        ? userFormSchema.omit({ password: true }) 
        : userFormSchema
    ),
    defaultValues: user ? {
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role as "admin" | "employee",
      position: user.position || "",
      phone: user.phone || "",
      isActive: user.isActive,
    } : {
      name: "",
      email: "",
      username: "",
      password: "",
      role: "employee",
      position: "",
      phone: "",
      isActive: true,
    },
  });
  
  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: UserFormValues) => {
      const response = await apiRequest("POST", "/api/users", userData);
      return await response.json();
    },
    onSuccess: (data) => {
      onSubmit(data);
      form.reset();
    },
    onError: (error) => {
      console.error("Error creating user:", error);
      // Check if error contains duplicate username error message
      if (error instanceof Error && error.message.includes("username")) {
        form.setError("username", { 
          message: "Username già in uso. Scegli un username diverso." 
        });
      } else {
        form.setError("root", { 
          message: "Si è verificato un errore durante la creazione dell'utente" 
        });
      }
    },
  });
  
  // Handle form submission
  const handleSubmit = (values: UserFormValues) => {
    if (isEdit) {
      onSubmit(values);
    } else {
      createUserMutation.mutate(values);
    }
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 mt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome Completo</FormLabel>
                <FormControl>
                  <Input placeholder="Nome Cognome" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="email@esempio.it" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="username"
                    {...field}
                    disabled={isEdit}
                  />
                </FormControl>
                {isEdit && (
                  <FormDescription>
                    L'username non può essere modificato
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          
          {!isEdit && (
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        type={showPassword ? "text" : "password"} 
                        placeholder="Password"
                        {...field}
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ruolo</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona ruolo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent position="popper">
                    <SelectItem value="admin">Amministratore</SelectItem>
                    <SelectItem value="employee">Dipendente</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="position"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Posizione (opzionale)</FormLabel>
                <FormControl>
                  <Input placeholder="Posizione" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telefono (opzionale)</FormLabel>
              <FormControl>
                <Input placeholder="+39 XXX XXX XXXX" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {/* Show any form-level errors */}
        {form.formState.errors.root && (
          <div className="text-sm font-medium text-destructive">
            {form.formState.errors.root.message}
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row sm:justify-end space-y-2 sm:space-y-0 sm:space-x-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="w-full sm:w-auto"
          >
            Annulla
          </Button>
          <Button 
            type="submit"
            disabled={
              createUserMutation.isPending || 
              !form.formState.isValid ||
              (isEdit ? false : !form.getValues("password"))
            }
            className="w-full sm:w-auto"
          >
            {isEdit ? "Aggiorna" : "Crea Utente"}
          </Button>
        </div>
      </form>
    </Form>
  );
}