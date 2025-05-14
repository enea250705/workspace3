import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { z } from "zod";
import { insertDocumentSchema } from "@shared/schema";

const router = Router();

// Schema di validazione per il caricamento di un documento
const uploadDocumentSchema = z.object({
  type: z.enum(["payslip", "tax_document"]),
  userId: z.number().int().positive(),
  period: z.string().min(1),
  filename: z.string().min(1),
  fileData: z.string(),
});

type UploadDocumentPayload = z.infer<typeof uploadDocumentSchema>;

// Middleware di autenticazione
const isAuthenticated = (req: Request, res: Response, next: Function) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};

// Middleware di verifica del ruolo admin
const isAdmin = (req: Request, res: Response, next: Function) => {
  if (req.isAuthenticated() && req.user?.role === "admin") {
    return next();
  }
  return res.status(403).json({ message: "Forbidden" });
};

// Carica un nuovo documento (solo admin)
router.post("/", isAdmin, async (req: Request, res: Response) => {
  try {
    // Validazione dei dati
    const validationResult = uploadDocumentSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        message: "Dati non validi",
        errors: validationResult.error.errors,
      });
    }
    
    const { type, userId, period, filename, fileData } = validationResult.data;
    
    // Creazione del documento
    const document = await storage.createDocument({
      type,
      userId,
      period,
      filename,
      fileData,
      uploadedBy: req.user!.id,
    });
    
    // Ottieni informazioni sull'utente per l'invio email
    const user = await storage.getUser(userId);
    
    if (user && user.isActive && user.email) {
      try {
        // Import email service
        const { sendDocumentNotification } = await import('../../server/services/nodemailer-service');
        
        // Invia email di notifica all'utente
        await sendDocumentNotification(user, type, period);
        
        console.log(`📧 Email di notifica documento inviata a ${user.name} (${user.email})`);
        
        // Crea anche una notifica in-app
        await storage.createNotification({
          userId: userId,
          type: "document_uploaded",
          message: `Nuovo documento disponibile: ${type === "payslip" ? "Busta Paga" : "Documento"} ${period}`,
          isRead: false,
          data: {
            documentId: document.id,
            documentType: type,
            period
          }
        });
      } catch (emailError) {
        console.error(`❌ Errore nell'invio email a ${user.email}:`, emailError);
      }
    }
    
    res.status(201).json(document);
  } catch (error) {
    console.error("Error creating document:", error);
    res.status(500).json({ message: "Failed to create document" });
  }
});

// Ottieni documenti (filtrati per utente se non admin)
router.get("/", isAuthenticated, async (req: Request, res: Response) => {
  try {
    let documents;
    
    if (req.user?.role === "admin") {
      // Gli admin vedono tutti i documenti
      documents = await storage.getAllDocuments();
    } else {
      // Gli utenti normali vedono solo i propri documenti
      documents = await storage.getUserDocuments(req.user!.id);
    }
    
    res.json(documents);
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.status(500).json({ message: "Failed to fetch documents" });
  }
});

// Ottieni un documento specifico
router.get("/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const documentId = parseInt(req.params.id);
    const document = await storage.getDocument(documentId);
    
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }
    
    // Verifica che l'utente sia l'admin o il proprietario del documento
    if (req.user?.role !== "admin" && document.userId !== req.user?.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    res.json(document);
  } catch (error) {
    console.error("Error fetching document:", error);
    res.status(500).json({ message: "Failed to fetch document" });
  }
});

// Elimina un documento (solo admin)
router.delete("/:id", isAdmin, async (req: Request, res: Response) => {
  try {
    const documentId = parseInt(req.params.id);
    
    // Verifica che il documento esista
    const document = await storage.getDocument(documentId);
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }
    
    // Elimina il documento
    const success = await storage.deleteDocument(documentId);
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ message: "Failed to delete document" });
    }
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({ message: "Failed to delete document" });
  }
});

export default router;