import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertUserSchema, User } from "@shared/schema";

const userRouter = Router();

// GET /api/users - Ottieni tutti gli utenti
userRouter.get("/", async (req, res) => {
  try {
    const users = await storage.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Error fetching users" });
  }
});

// POST /api/users - Crea un nuovo utente
userRouter.post("/", async (req, res) => {
  try {
    // Valida i dati dell'utente
    const userData = insertUserSchema.parse(req.body);
    
    // Verifica che l'username non sia già utilizzato
    const existingUser = await storage.getUserByUsername(userData.username);
    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }
    
    // Crea l'utente
    const user = await storage.createUser(userData);
    res.status(201).json(user);
  } catch (error) {
    console.error("Error creating user:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid user data", errors: error.errors });
    }
    res.status(500).json({ message: "Error creating user" });
  }
});

// POST /api/users/bulk - Crea multipli utenti in blocco
userRouter.post("/bulk", async (req, res) => {
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
        // Valida i dati dell'utente
        const validUserData = insertUserSchema.parse(userData);
        
        // Verifica che l'username non sia già utilizzato
        const existingUser = await storage.getUserByUsername(validUserData.username);
        if (existingUser) {
          results.failedCount++;
          results.failed.push(`Username '${validUserData.username}' già esistente`);
          continue;
        }
        
        // Crea l'utente
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

// GET /api/users/:id - Ottieni un utente specifico
userRouter.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const user = await storage.getUser(id);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Error fetching user" });
  }
});

// PATCH /api/users/:id - Aggiorna un utente
userRouter.patch("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userData = req.body;
    
    // Verifica che l'utente esista
    const existingUser = await storage.getUser(id);
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Aggiorna l'utente
    const updatedUser = await storage.updateUser(id, userData);
    res.json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Error updating user" });
  }
});

export default userRouter;