import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  CardFooter 
} from "@/components/ui/card";
import { Send, ArrowLeft } from "lucide-react";
import { User } from "@shared/schema";

// Form schema for message composition
const formSchema = z.object({
  toUserId: z.coerce.number({
    required_error: "Seleziona un destinatario"
  }),
  subject: z.string().min(1, "L'oggetto è obbligatorio"),
  content: z.string().min(1, "Il contenuto del messaggio è obbligatorio"),
  relatedToShiftId: z.coerce.number().optional()
});

type FormValues = z.infer<typeof formSchema>;

interface MessageComposerProps {
  onCancel: () => void;
  onSend: () => void;
  initialValues?: Partial<FormValues>;
  replyToUserId?: number;
}

export function MessageComposer({
  onCancel,
  onSend,
  initialValues,
  replyToUserId
}: MessageComposerProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Fetch users for recipient selection
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to fetch users");
      }
      return res.json();
    }
  });
  
  // Initialize form with default or initial values
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      toUserId: replyToUserId || initialValues?.toUserId || undefined,
      subject: initialValues?.subject || "",
      content: initialValues?.content || "",
      relatedToShiftId: initialValues?.relatedToShiftId
    }
  });
  
  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest("/api/messages", "POST", data);
    },
    onSuccess: () => {
      toast({
        title: "Messaggio inviato",
        description: "Il tuo messaggio è stato inviato con successo."
      });
      onSend();
    },
    onError: (error) => {
      console.error("Failed to send message:", error);
      toast({
        title: "Errore",
        description: "Impossibile inviare il messaggio. Riprova più tardi.",
        variant: "destructive"
      });
      setIsSubmitting(false);
    }
  });
  
  // Handle form submission
  const onSubmit = (values: FormValues) => {
    setIsSubmitting(true);
    sendMessageMutation.mutate(values);
  };
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            className="mr-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle>Nuovo messaggio</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="toUserId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Destinatario</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    defaultValue={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona un destinatario" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.map((user: User) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.name} ({user.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Oggetto</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Oggetto del messaggio" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contenuto</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Scrivi il tuo messaggio qui..."
                      rows={8}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="relatedToShiftId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Collegato al turno (opzionale)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      value={field.value || ""}
                      placeholder="ID del turno correlato"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-between border-t pt-4">
        <Button variant="outline" onClick={onCancel}>
          Annulla
        </Button>
        <Button
          type="submit"
          onClick={form.handleSubmit(onSubmit)}
          disabled={isSubmitting}
        >
          <Send className="mr-2 h-4 w-4" />
          Invia messaggio
        </Button>
      </CardFooter>
    </Card>
  );
}