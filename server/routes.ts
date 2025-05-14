/**
 * Routes for the WorkforceManager API
 * 
 * Note: Type assertions (as any) are used in this file to bypass TypeScript errors
 * related to Express middleware and route handlers. This is a temporary solution
 * until we can properly fix the type definitions.
 */
import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { z } from "zod";
import MemoryStore from "memorystore";
import { WebSocketServer, WebSocket } from "ws";
import { addDays, parseISO, format } from "date-fns";
import {
  insertUserSchema,
  insertScheduleSchema,
  insertShiftSchema,
  insertTimeOffRequestSchema,
  insertDocumentSchema,
  insertNotificationSchema
} from "../shared/schema.js";

// Initialize session store
const MemorySessionStore = MemoryStore(session);

// Funzione per la generazione automatica dei turni
async function generateAutomaticSchedule(
  startDate: string,
  endDate: string,
  users: any[],
  settings: {
    minHoursPerEmployee: number,
    maxHoursPerEmployee: number,
    startHour: string,
    endHour: string,
    distributeEvenly: boolean,
    respectTimeOffRequests: boolean
  },
  approvedTimeOffs: any[] = []
): Promise<any[]> {
  // Risultato: array di turni da generare
  const shifts: any[] = [];
  
  // Calcola il numero di giorni nel periodo
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const days: string[] = [];
  
  // Crea un array di tutte le date nel periodo
  let currentDate = start;
  while (currentDate <= end) {
    days.push(format(currentDate, 'yyyy-MM-dd'));
    currentDate = addDays(currentDate, 1);
  }
  
  // Calcola per ogni dipendente i giorni in cui hanno ferie approvate
  const userTimeOffs: Record<number, string[]> = {};
  
  if (settings.respectTimeOffRequests) {
    // Inizializza l'oggetto per ogni utente
    users.forEach(user => {
      userTimeOffs[user.id] = [];
    });
    
    // Popola l'oggetto con i giorni di ferie
    approvedTimeOffs.forEach(timeOff => {
      const timeOffStart = parseISO(timeOff.startDate);
      const timeOffEnd = parseISO(timeOff.endDate);
      
      let current = timeOffStart;
      while (current <= timeOffEnd) {
        const dateStr = format(current, 'yyyy-MM-dd');
        
        // Se è mezza giornata, potremmo decidere diversamente in base alla logica aziendale
        // Qui per semplicità, anche una mezza giornata di ferie blocca l'intera giornata
        if (!userTimeOffs[timeOff.userId].includes(dateStr)) {
          userTimeOffs[timeOff.userId].push(dateStr);
        }
        
        current = addDays(current, 1);
      }
    });
  }
  
  // Calcola le ore totali per dipendente in base alla configurazione
  // Se distributeEvenly è true, tutti avranno ore simili
  let hoursPerEmployee: Record<number, number> = {};
  
  if (settings.distributeEvenly) {
    const totalEmployees = users.length;
    users.forEach(user => {
      // Calcola i giorni disponibili (totali - giorni di ferie)
      const availableDays = days.filter(day => !userTimeOffs[user.id]?.includes(day)).length;
      
      // Calcola le ore totali considerando i giorni disponibili
      const totalPossibleHours = availableDays * 8; // Assumiamo max 8 ore al giorno
      const targetHours = Math.min(settings.maxHoursPerEmployee, totalPossibleHours);
      
      hoursPerEmployee[user.id] = Math.max(settings.minHoursPerEmployee, targetHours);
    });
  } else {
    // Se non distribuiamo equamente, proviamo a dare il massimo delle ore a tutti
    users.forEach(user => {
      hoursPerEmployee[user.id] = settings.maxHoursPerEmployee;
    });
  }
  
  // Converti le ore di inizio e fine in numeri per facilitare i calcoli
  const startHourNum = parseInt(settings.startHour.split(':')[0]);
  const endHourNum = parseInt(settings.endHour.split(':')[0]);
  
  // Ore di lavoro disponibili in un giorno
  const hoursPerDay = endHourNum - startHourNum;
  
  // Per ogni giorno nel periodo
  days.forEach(day => {
    // Determina quanti dipendenti lavorano in questo giorno
    // Filtriamo i dipendenti che non hanno ferie in questo giorno
    const availableUsers = users.filter(user => !userTimeOffs[user.id]?.includes(day));
    
    // Se non ci sono dipendenti disponibili, salta questo giorno
    if (availableUsers.length === 0) return;
    
    // Distribuzione turni: per semplicità, facciamo turni di 8 ore o il massimo configurato
    // In un sistema reale, si potrebbe usare un algoritmo più sofisticato
    
    // Creiamo un array di ore per slot, ad esempio [8, 9, 10, ..., 17] per 8:00-18:00
    const timeSlots: number[] = [];
    for (let hour = startHourNum; hour < endHourNum; hour++) {
      timeSlots.push(hour);
    }
    
    // Distribuiamo i turni per questo giorno
    availableUsers.forEach(user => {
      // Verifica se questo utente ha ancora ore da assegnare
      if (hoursPerEmployee[user.id] <= 0) return;
      
      // Determiniamo la lunghezza del turno (4 o 8 ore in base alle ore rimaste)
      // Per semplicità, facciamo turni di 4 o 8 ore
      let shiftLength = 8;
      if (hoursPerEmployee[user.id] < 8) {
        shiftLength = 4;
      }
      
      // Se non ci sono abbastanza ore rimaste nella giornata, salta
      if (shiftLength > timeSlots.length) return;
      
      // Determina l'ora di inizio del turno
      // Per semplicità, partiamo dall'inizio della giornata
      const shiftStartHour = timeSlots[0];
      const shiftEndHour = shiftStartHour + shiftLength;
      
      // Aggiungi il turno
      shifts.push({
        userId: user.id,
        day,
        startTime: `${String(shiftStartHour).padStart(2, '0')}:00`,
        endTime: `${String(shiftEndHour).padStart(2, '0')}:00`,
        type: 'regular',
        notes: null,
        area: null
      });
      
      // Aggiorna le ore rimaste per questo dipendente
      hoursPerEmployee[user.id] -= shiftLength;
      
      // Rimuovi gli slot utilizzati
      timeSlots.splice(0, shiftLength);
    });
  });
  
  return shifts;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Setup WebSocket server for real-time notifications
  const wss = new WebSocketServer({ noServer: true });
  
  // Store WebSocket clients by userId
  const clients = new Map<number, WebSocket[]>();
  
  // Handle WebSocket connection
  wss.on("connection", (ws: WebSocket, userId: number) => {
    if (!clients.has(userId)) {
      clients.set(userId, []);
    }
    
    clients.get(userId)?.push(ws);
    
    ws.on("close", () => {
      const userClients = clients.get(userId);
      if (userClients) {
        const index = userClients.indexOf(ws);
        if (index > -1) {
          userClients.splice(index, 1);
        }
        
        if (userClients.length === 0) {
          clients.delete(userId);
        }
      }
    });
  });
  
  // Handle WebSocket upgrade
  httpServer.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "", `http://${request.headers.host}`);
    const userId = parseInt(url.searchParams.get("userId") || "0");
    
    if (!userId) {
      socket.destroy();
      return;
    }
    
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, userId);
    });
  });
  
  // Function to send notification to a user via WebSocket
  const sendNotification = (userId: number, notification: any) => {
    const userClients = clients.get(userId);
    if (userClients) {
      const message = JSON.stringify(notification);
      userClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  };
  
  // Setup session middleware
  app.use(
    session({
      cookie: { maxAge: 86400000 },
      store: storage.sessionStore as any,
      resave: false,
      saveUninitialized: false,
      secret: process.env.SESSION_SECRET || "workforce-manager-secret"
    }) as any
  );
  
  // Initialize passport
  app.use(passport.initialize() as any);
  app.use(passport.session() as any);
  
  // Configure passport local strategy
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password"
      },
      async (email: string, password: string, done: any) => {
        try {
          const user = await storage.authenticateUser(email, password);
          if (!user) {
            return done(null, false, { message: "Invalid credentials" });
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
  
  // Serialize and deserialize user
  passport.serializeUser((user: any, done: any) => {
    done(null, user.id);
  });
  
  passport.deserializeUser(async (id: number, done: any) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
  
  // Auth middleware
  const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };
  
  const isAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated() && (req.user as any).role === "admin") {
      return next();
    }
    res.status(403).json({ message: "Forbidden" });
  };
  
  // Auth routes
  app.post("/api/login", (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ message: info.message });
      }
      req.logIn(user, (err) => {
        if (err) {
          return next(err);
        }
        return res.json({ user });
      });
    })(req, res, next);
  });
  
  // User management routes
  app.get("/api/users", isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (err) {
      res.status(500).json({ message: "Failed to get users" });
    }
  });
  
  app.post("/api/users", isAdmin, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      const user = await storage.createUser(userData);
      res.status(201).json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: err.errors });
      }
      res.status(400).json({ message: "Invalid user data" });
    }
  });
  
  // Bulk user creation
  app.post("/api/users/bulk", isAdmin, async (req, res) => {
    try {
      const { users } = req.body;
      
      if (!Array.isArray(users) || users.length === 0) {
        return res.status(400).json({ message: "Invalid user data. Expected array of users." });
      }
      
      const results = {
        createdCount: 0,
        failedCount: 0,
        failed: [] as string[]
      };
      
      // Process each user
      for (const userData of users) {
        try {
          // Validate user data
          const validUserData = insertUserSchema.parse(userData);
          
          // Check if username already exists
          const existingUser = await storage.getUserByUsername(validUserData.username);
          if (existingUser) {
            results.failedCount++;
            results.failed.push(`Username '${validUserData.username}' già esistente`);
            continue;
          }
          
          // Create user
          await storage.createUser(validUserData);
          results.createdCount++;
        } catch (validationError) {
          results.failedCount++;
          if (validationError instanceof z.ZodError) {
            results.failed.push(`Dati non validi per l'utente: ${userData.username || "unknown"}`);
          } else {
            results.failed.push(`Errore nella creazione dell'utente: ${userData.username || "unknown"}`);
          }
        }
      }
      
      res.status(201).json(results);
    } catch (error) {
      console.error("Error creating bulk users:", error);
      res.status(500).json({ message: "Error creating users" });
    }
  });
  
  app.get("/api/users/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Only admins or the user themselves can get user details
      if ((req.user as any).role !== "admin" && (req.user as any).id !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      res.json(user);
    } catch (err) {
      res.status(500).json({ message: "Failed to get user" });
    }
  });
  
  app.patch("/api/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const userData = req.body;
      
      // Don't allow changing username
      if (userData.username) {
        delete userData.username;
      }
      
      const user = await storage.updateUser(userId, userData);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (err) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });
  
  // Schedule management routes
  // Ottieni tutte le programmazioni
  app.get("/api/schedules/all", isAuthenticated, async (req, res) => {
    try {
      const schedules = await storage.getAllSchedules();
      console.log("Retrieved all schedules:", schedules);
      
      // SOLUZIONE DRASTICA: Ordina gli schedule per data e per ID (decrescente)
      // Gli schedule più recenti (ID più alto) appariranno per primi
      const sortedSchedules = [...schedules].sort((a, b) => {
        // Prima ordina per data di inizio (più recente prima)
        const dateComparison = new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
        if (dateComparison !== 0) return dateComparison;
        
        // Se le date sono uguali, ordina per ID (più alto prima)
        return b.id - a.id;
      });
      
      console.log("🔄 SCHEDULES ORDINATI per data (più recente prima) e ID (più alto prima)");
      res.json(sortedSchedules);
    } catch (err) {
      console.error("Error getting all schedules:", err);
      res.status(500).json({ message: "Failed to get schedules" });
    }
  });

  // Ottieni una programmazione specifica per data o l'attuale
  app.get("/api/schedules", isAuthenticated, async (req, res) => {
    try {
      // Verifica e log di tutti i parametri per debug
      console.log("📊 PARAMETRI RICHIESTA SCHEDULE:", { 
        query: req.query,
        id: req.query.id,
        startDate: req.query.startDate,
        endDate: req.query.endDate
      });
      
      // MIGLIORAMENTO: gestione esplicita dell'ID
      // Se viene fornito un ID specifico, restituisce quella programmazione
      if (req.query.id) {
        // Usa Number() per assicurarsi che sia un numero
        const scheduleId = Number(req.query.id);
        console.log(`🔍 Ricerca schedule per ID specifico: ${scheduleId}`);
        
        const schedule = await storage.getSchedule(scheduleId);
        
        if (schedule) {
          console.log(`✅ Schedule trovato con ID ${scheduleId}:`, schedule);
          return res.json(schedule);
        } else {
          console.log(`⚠️ Nessuno schedule trovato con ID ${scheduleId}`);
          return res.json(null);
        }
      }
      
      // Altrimenti cerca per intervallo di date
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date();
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      
      // Se non è specificata una data di fine, usa una settimana di default
      if (!req.query.endDate) {
        endDate.setDate(endDate.getDate() + 7);
      }
      
      console.log(`🔍 Ricerca schedule per intervallo date: ${startDate.toISOString()} - ${endDate.toISOString()}`);
      
      const schedule = await storage.getScheduleByDateRange(startDate, endDate);
      
      if (schedule) {
        console.log(`✅ Schedule trovato per intervallo date:`, schedule);
      } else {
        console.log(`⚠️ Nessuno schedule trovato per intervallo date`);
      }
      
      res.json(schedule || null);
    } catch (err) {
      console.error("❌ Errore nel recupero schedule:", err);
      res.status(500).json({ message: "Failed to get schedule" });
    }
  });
  
  // API speciale per ottenere un nuovo turno vuoto (senza turni)
  app.get("/api/schedules/:id/new", isAdmin, async (req, res) => {
    try {
      const scheduleId = parseInt(req.params.id);
      const schedule = await storage.getSchedule(scheduleId);
      
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      
      // SOLUZIONE RADICALE: Eliminazione fisica di tutti i turni per questo schedule
      try {
        // Ottieni tutti i turni esistenti
        const allShifts = await storage.getShifts(scheduleId);
        console.log(`🧹 PULIZIA TOTALE: Trovati ${allShifts.length} turni da eliminare per lo schedule ID ${scheduleId}`);
        
        // Elimina manualmente ogni turno
        let eliminatiCount = 0;
        for (const shift of allShifts) {
          await storage.deleteShift(shift.id);
          eliminatiCount++;
        }
        
        console.log(`✅ PULIZIA COMPLETA: Eliminati ${eliminatiCount} turni per lo schedule ID ${scheduleId}`);
      } catch (error) {
        console.error(`❌ Errore nell'eliminazione dei turni:`, error);
      }
      
      res.json({
        ...schedule,
        isNew: true,
        isEmpty: true,
        isClean: true,
        shifts: [] // Inviamo esplicitamente un array vuoto di turni
      });
    } catch (err) {
      console.error("Error getting clean schedule:", err);
      res.status(500).json({ message: "Failed to reset schedule" });
    }
  });
  
  // IMPLEMENTAZIONE COMPLETAMENTE NUOVA:
  // API per creare un NUOVO schedule COMPLETAMENTE pulito garantito
  app.post("/api/schedules/new-empty", isAdmin, async (req, res) => {
    try {
      // Valida i dati di input
      const scheduleData = insertScheduleSchema.parse({
        ...req.body,
        createdBy: (req.user as any).id
      });
      
      // FASE 1: Verifica conflitti con date esistenti
      const startDate = scheduleData.startDate;
      const endDate = scheduleData.endDate;
      
      console.log("📅 NUOVA RICHIESTA SCHEDULE:", { startDate, endDate });
      
      // Ottieni tutti gli schedule esistenti
      const allSchedules = await storage.getAllSchedules();
      
      // Identifica schedule con date in conflitto (sovrapposte)
      const conflictingSchedules = allSchedules.filter((s: any) => 
        (s.startDate === startDate && s.endDate === endDate) || 
        (s.startDate <= startDate && s.endDate >= startDate) ||
        (s.startDate <= endDate && s.endDate >= endDate)
      );
      
      // Log informativo sui conflitti trovati
      console.log(`🔍 Analisi date: Rilevati ${conflictingSchedules.length} schedule con date in conflitto`);
      if (conflictingSchedules.length > 0) {
        console.log("📊 Schedule in conflitto:", 
          conflictingSchedules.map((s: any) => ({ 
            id: s.id, 
            periodo: `${s.startDate} al ${s.endDate}`,
            pubblicato: s.isPublished 
          }))
        );
      }
      
      // FASE 2: GESTIONE DRASTICA DEI CONFLITTI
      // Per ogni schedule in conflitto, elimina i turni associati se non è pubblicato
      for (const conflictSchedule of conflictingSchedules) {
        if (conflictSchedule.isPublished) {
          console.log(`⚠️ ATTENZIONE: Schedule ID ${conflictSchedule.id} è già pubblicato, non verrà modificato`);
          continue;
        }
        
        console.log(`🧹 PULIZIA RADICALE: Iniziata eliminazione turni per schedule ID ${conflictSchedule.id}`);
        
        try {
          // Ottieni tutti i turni dello schedule
          const allShifts = await storage.getShifts(conflictSchedule.id);
          console.log(`   ┌── Trovati ${allShifts.length} turni da eliminare`);
          
          // Elimina ogni singolo turno
          let successCount = 0;
          for (const shift of allShifts) {
            const success = await storage.deleteShift(shift.id);
            if (success) successCount++;
          }
          
          console.log(`   └── ✅ Eliminati ${successCount}/${allShifts.length} turni con successo`);
          
          // Se possibile, elimina anche lo schedule stesso
          try {
            if (storage.deleteSchedule && typeof storage.deleteSchedule === 'function') {
              const deleted = await storage.deleteSchedule(conflictSchedule.id);
              if (deleted) {
                console.log(`   └── 🗑️ Schedule ID ${conflictSchedule.id} eliminato completamente`);
              }
            }
          } catch (innerError) {
            console.log(`   └── ℹ️ Schedule non eliminato, solo i turni sono stati rimossi`);
          }
        } catch (error) {
          console.error(`   └── ❌ Errore durante l'eliminazione:`, error);
        }
      }
      
      // FASE 3: CREAZIONE NUOVO SCHEDULE (completamente vuoto)
      console.log("🏗️ Creazione nuovo schedule completamente VUOTO...");
      
      // Marca esplicitamente schedule come non pubblicato
      const newScheduleData = {
        ...scheduleData,
        isPublished: false,
        publishedAt: null
      };
      
      // Crea uno schedule totalmente pulito
      const schedule = await storage.createSchedule(newScheduleData);
      
      // FASE 4: RISPOSTA CON METADATA AGGIUNTIVI 
      const responseSchedule = {
        ...schedule,
        isNew: true,           // Flag per indicare che è nuovo
        isEmpty: true,         // Flag per indicare che è vuoto
        isClean: true,         // Flag per indicare che è stato creato pulito
        creationTime: new Date().toISOString()  // Timestamp esatto di creazione
      };
      
      // Log finale di successo
      console.log("✅ NUOVO SCHEDULE CREATO CORRETTAMENTE:", {
        id: schedule.id, 
        periodo: `${schedule.startDate} al ${schedule.endDate}`,
        timestamp: new Date().toISOString()
      });
      
      // Invia risposta
      res.status(201).json(responseSchedule);
    } catch (err) {
      console.error("❌ ERRORE nella creazione dello schedule:", err);
      res.status(400).json({ 
        message: "Impossibile creare il nuovo schedule", 
        error: String(err),
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Endpoint standard per la creazione di schedule (manteniamo per backward compatibility)
  app.post("/api/schedules", isAdmin, async (req, res) => {
    try {
      const scheduleData = insertScheduleSchema.parse({
        ...req.body,
        createdBy: (req.user as any).id
      });
      
      const schedule = await storage.createSchedule(scheduleData);
      res.status(201).json(schedule);
    } catch (err) {
      res.status(400).json({ message: "Invalid schedule data" });
    }
  });
  
  app.post("/api/schedules/:id/publish", isAdmin, async (req, res) => {
    try {
      console.log("Publishing schedule:", req.params.id);
      const scheduleId = parseInt(req.params.id);
      const schedule = await storage.publishSchedule(scheduleId);
      
      if (!schedule) {
        console.log("Schedule not found:", scheduleId);
        return res.status(404).json({ message: "Schedule not found" });
      }
      
      console.log("Schedule published successfully:", schedule);
      
      // Get all users
      const users = await storage.getAllUsers();
      
      // Create notifications and send emails to all users
      for (const user of users) {
        if (user.isActive && user.role !== 'admin') { // Invia solo ai dipendenti, non agli admin
          // Crea notifica nell'app
          const notification = await storage.createNotification({
            userId: user.id,
            type: "schedule_update",
            message: "Nuova pianificazione turni pubblicata",
            isRead: false,
            data: {
              scheduleId: schedule.id,
              startDate: schedule.startDate,
              endDate: schedule.endDate
            }
          });
          
          // Invia notifica real-time
          sendNotification(user.id, {
            type: "schedule_update",
            message: "Nuova pianificazione turni pubblicata",
            data: notification
          });
          
          // Recupera i turni specifici dell'utente per questo schedule
          try {
            // Ottieni i turni dell'utente per questo schedule
            const userShifts = await storage.getUserShifts(user.id, schedule.id);
            console.log(`🔍 Recuperati ${userShifts.length} turni per ${user.name}`);
            
            // Invia email con i dettagli dei turni inclusi
            const { sendScheduleNotification } = await import('./services/nodemailer-service.js');
            await sendScheduleNotification(user, schedule.startDate, schedule.endDate, userShifts);
            console.log(`📧 Email di notifica turno inviata a ${user.name} (${user.email}) con ${userShifts.length} turni inclusi`);
          } catch (emailError) {
            console.error(`❌ Errore nell'invio email a ${user.email}:`, emailError);
          }
        }
      }
      
      res.json(schedule);
    } catch (err) {
      console.error("Failed to publish schedule:", err);
      res.status(500).json({ message: "Failed to publish schedule", error: String(err) });
    }
  });
  
  // NUOVA API per la gestione dei turni - completamente riprogettata
  app.get("/api/schedules/:scheduleId/shifts", isAuthenticated, async (req, res) => {
    try {
      const scheduleId = parseInt(req.params.scheduleId);
      
      // Verifica se è una richiesta speciale che richiede una tabella completamente vuota
      // Questo controllo ha la massima priorità
      if (req.query.forceEmpty === 'true' || req.query.isNew === 'true' || req.query.reset === 'true') {
        console.log("🚨 FORZATURA TABELLA VUOTA 🚨 - Restituendo array vuoto di turni per lo schedule:", scheduleId);
        console.log("Parametri di reset:", req.query);
        return res.json([]);  // Invia SEMPRE un array vuoto
      }
      
      // Ottieni una lista di tutti gli schedule
      const allSchedules = await storage.getAllSchedules();
      
      // Verifica se lo schedule richiesto è uno dei più recenti
      // Nota: Protezione disabilitata per consentire la visualizzazione immediata dei turni
      const isNewSchedule = false; // Disabilitato per consentire test immediati
      
      // Originale (commentato):
      // const isNewSchedule = allSchedules.some(s => 
      //   s.id === scheduleId && 
      //   new Date(s.createdAt || s.updatedAt) > new Date(Date.now() - 5 * 60 * 1000)  // creato negli ultimi 5 minuti
      // );
      
      // Se è un nuovo schedule (disabilitato per ora)
      if (isNewSchedule) {
        console.log("🆕 NUOVO SCHEDULE RILEVATO 🆕 - Restituendo tabella vuota per:", scheduleId);
        return res.json([]);
      }
      
      // Per tutte le altre richieste normali, procedi come al solito
      if ((req.user as any).role === "admin") {
        // Admins can see all shifts
        const shifts = await storage.getShifts(scheduleId);
        res.json(shifts);
      } else {
        // Employees can only see their own shifts
        const shifts = await storage.getUserShifts((req.user as any).id, scheduleId);
        res.json(shifts);
      }
    } catch (err) {
      console.error("Errore nel recupero dei turni:", err);
      res.status(500).json({ message: "Errore nel recupero dei turni" });
    }
  });
  
  // Endpoint specifico per ottenere i turni di un utente specifico
  app.get("/api/schedules/:scheduleId/shifts/user/:userId", isAuthenticated, async (req, res) => {
    try {
      const scheduleId = parseInt(req.params.scheduleId);
      const userId = parseInt(req.params.userId);
      
      // Verifica che l'utente stia accedendo solo ai propri turni o sia un amministratore
      if ((req.user as any).role !== "admin" && (req.user as any).id !== userId) {
        return res.status(403).json({ message: "Not authorized to view these shifts" });
      }
      
      const shifts = await storage.getUserShifts(userId, scheduleId);
      res.json(shifts);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error fetching user shifts" });
    }
  });
  
  app.post("/api/shifts", isAdmin, async (req, res) => {
    try {
      const shiftData = insertShiftSchema.parse(req.body);
      const shift = await storage.createShift(shiftData);
      
      const schedule = await storage.getSchedule(shiftData.scheduleId);
      
      // If the schedule is published, notify the user
      if (schedule && schedule.isPublished) {
        const notification = await storage.createNotification({
          userId: shiftData.userId,
          type: "shift_update",
          message: "Your work schedule has been updated",
          isRead: false,
          data: {
            shiftId: shift.id,
            scheduleId: shift.scheduleId,
            day: shift.day
          }
        });
        
        // Send real-time notification
        sendNotification(shiftData.userId, {
          type: "shift_update",
          message: "Your work schedule has been updated",
          data: notification
        });
      }
      
      res.status(201).json(shift);
    } catch (err) {
      res.status(400).json({ message: "Invalid shift data" });
    }
  });
  
  app.patch("/api/shifts/:id", isAdmin, async (req, res) => {
    try {
      const shiftId = parseInt(req.params.id);
      const shiftData = req.body;
      
      const shift = await storage.updateShift(shiftId, shiftData);
      
      if (!shift) {
        return res.status(404).json({ message: "Shift not found" });
      }
      
      const schedule = await storage.getSchedule(shift.scheduleId);
      
      // If the schedule is published, notify the user
      if (schedule && schedule.isPublished) {
        const notification = await storage.createNotification({
          userId: shift.userId,
          type: "shift_update",
          message: "Your work schedule has been updated",
          isRead: false,
          data: {
            shiftId: shift.id,
            scheduleId: shift.scheduleId,
            day: shift.day
          }
        });
        
        // Send real-time notification
        sendNotification(shift.userId, {
          type: "shift_update",
          message: "Your work schedule has been updated",
          data: notification
        });
      }
      
      res.json(shift);
    } catch (err) {
      res.status(500).json({ message: "Failed to update shift" });
    }
  });
  
  app.delete("/api/shifts/:id", isAdmin, async (req, res) => {
    try {
      const shiftId = parseInt(req.params.id);
      const shift = await storage.deleteShift(shiftId);
      
      if (!shift) {
        return res.status(404).json({ message: "Shift not found" });
      }
      
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete shift" });
    }
  });
  
  // Auto-generation preview endpoint
  app.post("/api/schedules/preview", isAdmin, async (req, res) => {
    try {
      const { startDate, endDate, userIds, settings } = req.body;
      
      // Ottieni richieste di ferie approvate per il periodo specificato
      let approvedTimeOffs: any[] = [];
      if (settings.respectTimeOffRequests) {
        approvedTimeOffs = (await storage.getAllTimeOffRequests()).filter(
          (request: any) => 
            request.status === "approved" &&
            userIds.includes(request.userId) &&
            // Controllo sovrapposizione date
            (
              (new Date(request.startDate) >= new Date(startDate) && new Date(request.startDate) <= new Date(endDate)) ||
              (new Date(request.endDate) >= new Date(startDate) && new Date(request.endDate) <= new Date(endDate)) ||
              (new Date(request.startDate) <= new Date(startDate) && new Date(request.endDate) >= new Date(endDate))
            )
        );
      }
      
      // Dati utenti
      const users = await Promise.all(
        userIds.map(async (userId: number) => {
          const user = await storage.getUser(userId);
          return user;
        })
      );

      // Algoritmo di generazione automatica dei turni
      const shifts = await generateAutomaticSchedule(
        startDate,
        endDate,
        users.filter(Boolean) as any[],
        settings,
        approvedTimeOffs
      );
      
      // Restituisci anteprima
      res.json({
        startDate,
        endDate,
        isPublished: false,
        shifts
      });
    } catch (err) {
      console.error("Preview generation error:", err);
      res.status(500).json({ message: "Failed to generate schedule preview" });
    }
  });
  
  // Auto-generation and save endpoint
  app.post("/api/schedules/auto-generate", isAdmin, async (req, res) => {
    try {
      const { startDate, endDate, userIds, settings } = req.body;
      
      // Ottieni richieste di ferie approvate per il periodo specificato
      let approvedTimeOffs: any[] = [];
      if (settings.respectTimeOffRequests) {
        approvedTimeOffs = (await storage.getAllTimeOffRequests()).filter(
          (request: any) => 
            request.status === "approved" &&
            userIds.includes(request.userId) &&
            // Controllo sovrapposizione date
            (
              (new Date(request.startDate) >= new Date(startDate) && new Date(request.startDate) <= new Date(endDate)) ||
              (new Date(request.endDate) >= new Date(startDate) && new Date(request.endDate) <= new Date(endDate)) ||
              (new Date(request.startDate) <= new Date(startDate) && new Date(request.endDate) >= new Date(endDate))
            )
        );
      }
      
      // Dati utenti
      const users = await Promise.all(
        userIds.map(async (userId: number) => {
          const user = await storage.getUser(userId);
          return user;
        })
      );
      
      // Crea la pianificazione
      const schedule = await storage.createSchedule({
        startDate,
        endDate,
        isPublished: false,
        createdBy: (req.user as any).id
      });
      
      // Genera i turni automaticamente
      const shifts = await generateAutomaticSchedule(
        startDate,
        endDate,
        users.filter(Boolean) as any[],
        settings,
        approvedTimeOffs
      );
      
      // Salva i turni generati
      for (const shift of shifts) {
        await storage.createShift({
          ...shift,
          scheduleId: schedule.id
        });
      }
      
      res.status(201).json({
        ...schedule,
        shifts
      });
    } catch (err) {
      console.error("Auto-generation error:", err);
      res.status(500).json({ message: "Failed to auto-generate schedule" });
    }
  });
  
  // TimeOff request routes
  app.get("/api/time-off-requests", isAuthenticated, async (req, res) => {
    try {
      if ((req.user as any).role === "admin") {
        // Admins can see all requests
        const requests = await storage.getAllTimeOffRequests();
        res.json(requests);
      } else {
        // Employees can only see their own requests
        const requests = await storage.getUserTimeOffRequests((req.user as any).id);
        res.json(requests);
      }
    } catch (err) {
      res.status(500).json({ message: "Failed to get time-off requests" });
    }
  });
  
  // Get pending time off requests (admin only)
  app.get("/api/time-off-requests/pending", isAdmin, async (req, res) => {
    try {
      const requests = await storage.getPendingTimeOffRequests();
      res.json(requests);
    } catch (err) {
      res.status(500).json({ message: "Failed to get pending time-off requests" });
    }
  });
  
  app.post("/api/time-off-requests", isAuthenticated, async (req, res) => {
    try {
      const requestData = insertTimeOffRequestSchema.parse({
        ...req.body,
        userId: (req.user as any).id
      });
      
      const request = await storage.createTimeOffRequest(requestData);
      
      // Notify admins about the new request
      const admins = (await storage.getAllUsers()).filter((user: any) => user.role === "admin" && user.isActive);
      
      for (const admin of admins) {
        const notification = await storage.createNotification({
          userId: admin.id,
          type: "time_off_request",
          message: `New time-off request from ${(req.user as any).name}`,
          isRead: false,
          data: {
            requestId: request.id,
            userId: request.userId,
            userName: (req.user as any).name,
            startDate: request.startDate,
            endDate: request.endDate,
            type: request.type
          }
        });
        
        // Send real-time notification
        sendNotification(admin.id, {
          type: "time_off_request",
          message: `New time-off request from ${(req.user as any).name}`,
          data: notification
        });
      }
      
      // Invia email di notifica all'amministratore
      try {
        // Import del servizio email
        const { sendTimeOffRequestNotificationToAdmin } = await import('./services/nodemailer-service.js');
        
        // Invia email di notifica all'amministratore
        await sendTimeOffRequestNotificationToAdmin(
          req.user as any, 
          request.type, 
          request.startDate, 
          request.endDate,
          request.reason || ""
        );
        console.log(`📧 Email di notifica nuova richiesta inviata all'amministratore`);
      } catch (emailError) {
        console.error(`❌ Errore nell'invio email all'amministratore:`, emailError);
      }
      
      res.status(201).json(request);
    } catch (err) {
      res.status(400).json({ message: "Invalid request data" });
    }
  });
  
  app.post("/api/time-off-requests/:id/approve", isAdmin, (async (req: Request, res: Response) => {
    try {
      const requestId = parseInt(req.params.id);
      const request = await storage.approveTimeOffRequest(requestId, (req.user as any).id);
      
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }
      
      // Obtiene l'utente richiedente per inviare l'email
      const user = await storage.getUser(request.userId);
      
      // Notify the user about the approval
      const notification = await storage.createNotification({
        userId: request.userId,
        type: "request_approved",
        message: "La tua richiesta è stata approvata",
        isRead: false,
        data: {
          requestId: request.id,
          startDate: request.startDate,
          endDate: request.endDate,
          type: request.type
        }
      });
      
      // Invia email di notifica approvazione
      if (user && user.email) {
        try {
          // Import del servizio email
          const { sendTimeOffApprovalNotification } = await import('./services/nodemailer-service.js');
          
          // Invia email di notifica
          await sendTimeOffApprovalNotification(user, request.type, request.startDate, request.endDate);
          console.log(`📧 Email di notifica approvazione inviata a ${user.name} (${user.email})`);
        } catch (emailError) {
          console.error(`❌ Errore nell'invio email a ${user.email}:`, emailError);
        }
      }
      
      // Crea automaticamente i turni per il periodo di assenza
      const timeOffType = request.type;
      // Mapping del tipo di assenza al codice visualizzato nel turno
      let shiftType = "work"; // Default
      if (timeOffType === "vacation") {
        shiftType = "vacation"; // F per ferie
      } else if (timeOffType === "personal") {
        shiftType = "leave"; // P per permesso
      } else if (timeOffType === "sick") {
        shiftType = "sick"; // M per malattia
      }
      
      // Trova tutti gli schedules attivi che coprono il periodo della richiesta
      const allSchedules = await storage.getAllSchedules();
      const overlappingSchedules = allSchedules.filter((schedule: any) => {
        const scheduleStart = new Date(schedule.startDate);
        const scheduleEnd = new Date(schedule.endDate);
        const requestStart = new Date(request.startDate);
        const requestEnd = new Date(request.endDate);
        
        return (
          (requestStart >= scheduleStart && requestStart <= scheduleEnd) ||
          (requestEnd >= scheduleStart && requestEnd <= scheduleEnd) ||
          (requestStart <= scheduleStart && requestEnd >= scheduleEnd)
        );
      });
      
      console.log(`Trovati ${overlappingSchedules.length} schedules che si sovrappongono alla richiesta di assenza`);
      
      // Crea turni in tutti gli schedule sovrapposti
      for (const schedule of overlappingSchedules) {
        const scheduleStart = new Date(schedule.startDate);
        const scheduleEnd = new Date(schedule.endDate);
        const requestStart = new Date(request.startDate);
        const requestEnd = new Date(request.endDate);
        
        // Calcola il periodo effettivo da coprire in questo schedule
        const effectiveStart = requestStart < scheduleStart ? scheduleStart : requestStart;
        const effectiveEnd = requestEnd > scheduleEnd ? scheduleEnd : requestEnd;
        
        // Crea turni per ogni giorno nel periodo
        const days = ["lunedi", "martedi", "mercoledi", "giovedi", "venerdi", "sabato", "domenica"];
        const currentDay = new Date(effectiveStart);
        
        while (currentDay <= effectiveEnd) {
          const dayIndex = currentDay.getDay(); // 0 = domenica, 1 = lunedì, ...
          const dayName = days[dayIndex === 0 ? 6 : dayIndex - 1]; // Adatta all'indice italiano (0 = lunedì)
          
          // Verifica se esistono già turni per questo utente e giorno
          const existingShifts = await storage.getShifts(schedule.id);
          const userDayShifts = existingShifts.filter(
            (s: any) => s.userId === request.userId && s.day === dayName
          );
          
          // Se l'utente ha già turni in questo giorno, aggiorna il tipo invece di creare nuovi
          if (userDayShifts.length > 0) {
            for (const shift of userDayShifts) {
              await storage.updateShift(shift.id, { 
                type: shiftType,
                notes: `Assenza automatica: ${request.type}` 
              });
              console.log(`Aggiornato turno esistente ID ${shift.id} per l'utente ${request.userId} in ${dayName} come ${shiftType}`);
            }
          } else {
            // Crea nuovi turni di assenza per l'intera giornata
            const shiftData = {
              scheduleId: schedule.id,
              userId: request.userId,
              day: dayName,
              startTime: "09:00",
              endTime: "18:00",
              type: shiftType,
              notes: `Assenza automatica: ${request.type}`,
              area: "Assenza"
            };
            
            await storage.createShift(shiftData);
            console.log(`Creato nuovo turno di assenza per l'utente ${request.userId} in ${dayName} come ${shiftType}`);
          }
          
          // Passa al giorno successivo
          currentDay.setDate(currentDay.getDate() + 1);
        }
      }
      
      // Send real-time notification
      sendNotification(request.userId, {
        type: "request_approved",
        message: "Your time-off request has been approved",
        data: notification
      });
      
      res.json(request);
    } catch (err) {
      console.error("Errore durante l'approvazione della richiesta:", err);
      res.status(500).json({ message: "Failed to approve request" });
    }
  }) as RequestHandler);
  
  app.post("/api/time-off-requests/:id/reject", isAdmin, (async (req: Request, res: Response) => {
    try {
      const requestId = parseInt(req.params.id);
      const request = await storage.rejectTimeOffRequest(requestId, (req.user as any).id);
      
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }
      
      // Ottiene l'utente richiedente per inviare l'email
      const user = await storage.getUser(request.userId);
      
      // Notify the user about the rejection
      const notification = await storage.createNotification({
        userId: request.userId,
        type: "request_rejected",
        message: "La tua richiesta è stata respinta",
        isRead: false,
        data: {
          requestId: request.id,
          startDate: request.startDate,
          endDate: request.endDate,
          type: request.type,
          reason: req.body.reason // Motivo del rifiuto (opzionale)
        }
      });
      
      // Invia email di notifica rifiuto
      if (user && user.email) {
        try {
          // Import del servizio email
          const { sendTimeOffRejectionNotification } = await import('./services/nodemailer-service.js');
          
          // Invia email di notifica
          await sendTimeOffRejectionNotification(user, request.type, request.startDate, request.endDate);
          console.log(`📧 Email di notifica rifiuto inviata a ${user.name} (${user.email})`);
        } catch (emailError) {
          console.error(`❌ Errore nell'invio email a ${user.email}:`, emailError);
        }
      }
      
      // Send real-time notification
      sendNotification(request.userId, {
        type: "request_rejected",
        message: "La tua richiesta è stata respinta",
        data: notification
      });
      
      res.json(request);
    } catch (err) {
      console.error("Errore durante il rifiuto della richiesta:", err);
      res.status(500).json({ message: "Failed to reject request" });
    }
  }) as RequestHandler);
  
  // Document management routes
  app.get("/api/documents", isAuthenticated, (async (req: Request, res: Response) => {
    try {
      const type = req.query.type as string | undefined;
      
      if ((req.user as any).role === "admin") {
        // Admins can see all documents
        const documents = await storage.getAllDocuments(type);
        res.json(documents);
      } else {
        // Employees can only see their own documents
        const documents = await storage.getUserDocuments((req.user as any).id, type);
        res.json(documents);
      }
    } catch (err) {
      res.status(500).json({ message: "Failed to get documents" });
    }
  }) as RequestHandler);
  
  // Endpoint di test per verificare l'invio email (solo per admin)
  app.post("/api/test/email", isAdmin, (async (req: Request, res: Response) => {
    try {
      console.log("🧪 Richiesta test email ricevuta");
      
      // Importa il servizio email
      const { testEmailService } = await import('./services/nodemailer-service.js');
      
      // Esegui il test
      const result = await testEmailService();
      
      // Rispondi con il risultato
      res.json({ 
        success: result, 
        timestamp: new Date().toISOString(),
        message: result ? "Email di test inviata con successo" : "Errore nell'invio dell'email di test"
      });
    } catch (err) {
      console.error("❌ Errore durante il test email:", err);
      res.status(500).json({ 
        success: false,
        error: String(err),
        timestamp: new Date().toISOString()
      });
    }
  }) as RequestHandler);
  
  app.get("/api/documents/:id", isAuthenticated, (async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);
      const document = await storage.getDocument(documentId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Only admins or the document owner can view the document
      if ((req.user as any).role !== "admin" && (req.user as any).id !== document.userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      res.json(document);
    } catch (err) {
      res.status(500).json({ message: "Failed to get document" });
    }
  }) as RequestHandler);
  
  app.post("/api/documents", isAdmin, (async (req: Request, res: Response) => {
    try {
      const documentData = insertDocumentSchema.parse({
        ...req.body,
        uploadedBy: (req.user as any).id
      });
      
      const document = await storage.createDocument(documentData);
      
      // Ottieni informazioni sull'utente per l'invio email
      const user = await storage.getUser(document.userId);
      
      // Notify the user about the new document
      const notification = await storage.createNotification({
        userId: document.userId,
        type: "document_upload",
        message: `Nuovo ${document.type === "payslip" ? "Busta Paga" : "Documento Fiscale"} disponibile`,
        isRead: false,
        data: {
          documentId: document.id,
          type: document.type,
          period: document.period
        }
      });
      
      // Send real-time notification
      sendNotification(document.userId, {
        type: "document_upload",
        message: `Nuovo ${document.type === "payslip" ? "Busta Paga" : "Documento Fiscale"} disponibile`,
        data: notification
      });
      
      // Invia email di notifica
      if (user && user.email) {
        try {
          const { sendDocumentNotification } = await import('./services/nodemailer-service.js');
          await sendDocumentNotification(user, document.type, document.period);
          console.log(`📧 Email di notifica documento inviata a ${user.name} (${user.email})`);
        } catch (emailError) {
          console.error(`❌ Errore nell'invio email:`, emailError);
        }
      }
      
      res.status(201).json(document);
    } catch (err) {
      res.status(400).json({ message: "Invalid document data" });
    }
  }) as RequestHandler);
  
  app.delete("/api/documents/:id", isAdmin, (async (req: Request, res: Response) => {
    try {
      const documentId = parseInt(req.params.id);
      const result = await storage.deleteDocument(documentId);
      
      if (!result) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete document" });
    }
  }) as RequestHandler);
  
  // Notification routes
  app.get("/api/notifications", isAuthenticated, async (req, res) => {
    try {
      const notifications = await storage.getUserNotifications((req.user as any).id);
      res.json(notifications);
    } catch (err) {
      res.status(500).json({ message: "Failed to get notifications" });
    }
  });
  
  app.post("/api/notifications/:id/mark-read", isAuthenticated, async (req, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      const notification = await storage.markNotificationAsRead(notificationId);
      
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      // Only the notification owner can mark it as read
      if (notification.userId !== (req.user as any).id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      res.json(notification);
    } catch (err) {
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });
  
  app.post("/api/notifications/mark-all-read", isAuthenticated, async (req, res) => {
    try {
      await storage.markAllUserNotificationsAsRead((req.user as any).id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to mark notifications as read" });
    }
  });
  
  // Message routes
  app.get("/api/messages/received", isAuthenticated, async (req, res) => {
    try {
      const messages = await storage.getUserReceivedMessages((req.user as any).id);
      res.json(messages);
    } catch (err) {
      res.status(500).json({ message: "Failed to get received messages" });
    }
  });
  
  app.get("/api/messages/sent", isAuthenticated, async (req, res) => {
    try {
      const messages = await storage.getUserSentMessages((req.user as any).id);
      res.json(messages);
    } catch (err) {
      res.status(500).json({ message: "Failed to get sent messages" });
    }
  });
  
  app.get("/api/messages/:id", isAuthenticated, async (req, res) => {
    try {
      const messageId = parseInt(req.params.id);
      const message = await storage.getMessage(messageId);
      
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      
      const userId = (req.user as any).id;
      // Verify that the user is either the sender or receiver of the message
      if (message.fromUserId !== userId && message.toUserId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // If the user is the receiver and the message is unread, mark it as read
      if (message.toUserId === userId && !message.isRead) {
        await storage.markMessageAsRead(messageId);
      }
      
      res.json(message);
    } catch (err) {
      res.status(500).json({ message: "Failed to get message" });
    }
  });
  
  app.post("/api/messages", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { toUserId, subject, content, relatedToShiftId } = req.body;
      
      if (!toUserId || !subject || !content) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Verify that recipient exists
      const recipient = await storage.getUser(toUserId);
      if (!recipient) {
        return res.status(404).json({ message: "Recipient not found" });
      }
      
      const message = await storage.createMessage({
        fromUserId: userId,
        toUserId,
        subject,
        content,
        relatedToShiftId
      });
      
      // Create a notification for the recipient
      await storage.createNotification({
        userId: toUserId,
        type: "new_message",
        message: `Hai ricevuto un nuovo messaggio: ${subject}`,
        isRead: false,
        data: { messageId: message.id }
      });
      
      res.status(201).json(message);
    } catch (err) {
      res.status(500).json({ message: "Failed to create message" });
    }
  });
  
  app.post("/api/messages/:id/mark-read", isAuthenticated, async (req, res) => {
    try {
      const messageId = parseInt(req.params.id);
      const message = await storage.getMessage(messageId);
      
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      
      // Only the recipient can mark a message as read
      if (message.toUserId !== (req.user as any).id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const updatedMessage = await storage.markMessageAsRead(messageId);
      res.json(updatedMessage);
    } catch (err) {
      res.status(500).json({ message: "Failed to mark message as read" });
    }
  });
  
  app.delete("/api/messages/:id", isAuthenticated, async (req, res) => {
    try {
      const messageId = parseInt(req.params.id);
      const message = await storage.getMessage(messageId);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      
      const userId = (req.user as any).id;
      // Only sender or recipient can delete a message
      if (message.fromUserId !== userId && message.toUserId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const success = await storage.deleteMessage(messageId);
      res.json({ success });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete message" });
    }
  });
  
  return httpServer;
}
