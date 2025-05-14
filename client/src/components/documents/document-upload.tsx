import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const formSchema = z.object({
  type: z.string(),
  userId: z.coerce.number().min(1, "Seleziona un dipendente"),
  period: z.string().min(1, "Il periodo è obbligatorio"),
  file: z
    .instanceof(FileList)
    .refine((files) => files.length > 0, "Il file è obbligatorio")
    .refine(
      (files) => files[0].size <= MAX_FILE_SIZE,
      "Il file deve essere inferiore a 5MB"
    )
    .refine(
      (files) => files[0].type === "application/pdf",
      "Il file deve essere in formato PDF"
    ),
});

type FormValues = z.infer<typeof formSchema>;

export function DocumentUpload({ users }: { users: any[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "payslip",
      period: "",
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      setIsUploading(true);
      
      const file = data.file[0];
      const reader = new FileReader();
      
      return new Promise((resolve, reject) => {
        reader.onloadend = async () => {
          try {
            // Assicurati che il risultato sia una stringa
            const fileResult = reader.result as string;
            
            // Estrai il dato base64, rimuovendo il prefisso se presente
            const base64Data = fileResult.includes('base64,')
              ? fileResult.split('base64,')[1]
              : fileResult;
            
            const payload = {
              type: data.type,
              userId: data.userId,
              period: data.period,
              filename: file.name,
              fileData: base64Data,
            };
            
            const response = await apiRequest("POST", "/api/documents", payload);
            resolve(response);
          } catch (err) {
            reject(err);
          } finally {
            setIsUploading(false);
          }
        };
        
        reader.onerror = () => {
          setIsUploading(false);
          reject(new Error("Errore nella lettura del file"));
        };
        
        reader.readAsDataURL(file);
      });
    },
    onSuccess: () => {
      toast({
        title: "Documento caricato",
        description: "Il documento è stato caricato con successo",
      });
      form.reset({
        type: "payslip",
        period: "",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante il caricamento del documento",
        variant: "destructive",
      });
    },
  });

  function onSubmit(values: FormValues) {
    uploadMutation.mutate(values);
  }

  // Determina il placeholder per il periodo in base al tipo di documento
  const periodPlaceholder = form.watch("type") === "payslip" 
    ? "es. Maggio 2025" 
    : "es. 2024";

  return (
    <Card className="bg-white max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Carica nuovo documento</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo di documento</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona il tipo di documento" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent position="popper">
                        <SelectItem value="payslip">Busta paga</SelectItem>
                        <SelectItem value="tax_document">CUD</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dipendente</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona un dipendente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent position="popper">
                        {users
                          .filter(user => user.role !== "admin")
                          .map(user => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="period"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {form.watch("type") === "payslip" ? "Mese e anno" : "Anno"}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={periodPlaceholder}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="file"
              render={({ field: { onChange, value, ...fieldProps } }) => (
                <FormItem className="space-y-1">
                  <FormLabel>File PDF</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => onChange(e.target.files)}
                        {...fieldProps}
                        className="flex-1 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 focus:outline-none"
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full mt-4"
              disabled={isUploading || uploadMutation.isPending}
            >
              {isUploading || uploadMutation.isPending ? (
                <>
                  <span className="material-icons animate-spin mr-2">sync</span>
                  Caricamento in corso...
                </>
              ) : (
                "Carica documento"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}