import {
  users, schedules, shifts, timeOffRequests, documents, notifications, messages,
  type User, type InsertUser,
  type Schedule, type InsertSchedule,
  type Shift, type InsertShift,
  type TimeOffRequest, type InsertTimeOffRequest,
  type Document, type InsertDocument,
  type Notification, type InsertNotification,
  type Message, type InsertMessage
} from "@shared/schema";

export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  
  // Schedule management
  createSchedule(schedule: InsertSchedule): Promise<Schedule>;
  getSchedule(id: number): Promise<Schedule | undefined>;
  getScheduleByDateRange(startDate: Date, endDate: Date): Promise<Schedule | undefined>;
  getAllSchedules(): Promise<Schedule[]>;
  publishSchedule(id: number): Promise<Schedule | undefined>;
  deleteSchedule?(id: number): Promise<boolean>; // Nuova funzione opzionale per eliminare uno schedule
  
  // Shift management
  createShift(shift: InsertShift): Promise<Shift>;
  getShifts(scheduleId: number): Promise<Shift[]>;
  getUserShifts(userId: number, scheduleId: number): Promise<Shift[]>;
  updateShift(id: number, shiftData: Partial<InsertShift>): Promise<Shift | undefined>;
  deleteShift(id: number): Promise<boolean>;
  deleteAllShiftsForSchedule?(scheduleId: number): Promise<boolean>; // Funzione per eliminare tutti i turni di uno schedule
  
  // TimeOff requests
  createTimeOffRequest(request: InsertTimeOffRequest): Promise<TimeOffRequest>;
  getTimeOffRequest(id: number): Promise<TimeOffRequest | undefined>;
  getUserTimeOffRequests(userId: number): Promise<TimeOffRequest[]>;
  getPendingTimeOffRequests(): Promise<TimeOffRequest[]>;
  getAllTimeOffRequests(): Promise<TimeOffRequest[]>;
  approveTimeOffRequest(id: number, approverId: number): Promise<TimeOffRequest | undefined>;
  rejectTimeOffRequest(id: number, approverId: number): Promise<TimeOffRequest | undefined>;
  
  // Documents
  createDocument(document: InsertDocument): Promise<Document>;
  getDocument(id: number): Promise<Document | undefined>;
  getUserDocuments(userId: number, type?: string): Promise<Document[]>;
  getAllDocuments(type?: string): Promise<Document[]>;
  deleteDocument(id: number): Promise<boolean>;
  
  // Notifications
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUserNotifications(userId: number): Promise<Notification[]>;
  markNotificationAsRead(id: number): Promise<Notification | undefined>;
  markAllUserNotificationsAsRead(userId: number): Promise<boolean>;
  
  // Messages
  createMessage(message: InsertMessage): Promise<Message>;
  getMessage(id: number): Promise<Message | undefined>;
  getUserReceivedMessages(userId: number): Promise<Message[]>;
  getUserSentMessages(userId: number): Promise<Message[]>;
  markMessageAsRead(id: number): Promise<Message | undefined>;
  deleteMessage(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private schedules: Map<number, Schedule>;
  private shifts: Map<number, Shift>;
  private timeOffRequests: Map<number, TimeOffRequest>;
  private documents: Map<number, Document>;
  private notifications: Map<number, Notification>;
  private messages: Map<number, Message>;
  
  private userCurrentId: number;
  private scheduleCurrentId: number;
  private shiftCurrentId: number;
  private timeOffRequestCurrentId: number;
  private documentCurrentId: number;
  private notificationCurrentId: number;
  private messageCurrentId: number;
  
  constructor() {
    this.users = new Map();
    this.schedules = new Map();
    this.shifts = new Map();
    this.timeOffRequests = new Map();
    this.documents = new Map();
    this.notifications = new Map();
    this.messages = new Map();
    
    this.userCurrentId = 1;
    this.scheduleCurrentId = 1;
    this.shiftCurrentId = 1;
    this.timeOffRequestCurrentId = 1;
    this.documentCurrentId = 1;
    this.notificationCurrentId = 1;
    this.messageCurrentId = 1;
    
    // Creazione utente amministratore predefinito
    this.createUser({
      username: "admin",
      password: "davittorino2025@",
      name: "Admin",
      email: "admin@davittorino.it",
      role: "admin",
      isActive: true,
    });
  }
  
  // User management
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const now = new Date();
    const user: User = { ...insertUser, id, lastLogin: now };
    this.users.set(id, user);
    return user;
  }
  
  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    const updatedUser: User = { ...user, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  // Schedule management
  async createSchedule(scheduleData: InsertSchedule): Promise<Schedule> {
    const id = this.scheduleCurrentId++;
    const now = new Date();
    const schedule: Schedule = {
      ...scheduleData,
      id,
      publishedAt: null,
      updatedAt: now
    };
    
    this.schedules.set(id, schedule);
    return schedule;
  }
  
  async getSchedule(id: number): Promise<Schedule | undefined> {
    return this.schedules.get(id);
  }
  
  async getScheduleByDateRange(startDate: Date, endDate: Date): Promise<Schedule | undefined> {
    return Array.from(this.schedules.values()).find(
      (schedule) => 
        new Date(schedule.startDate) <= endDate && 
        new Date(schedule.endDate) >= startDate
    );
  }
  
  async getAllSchedules(): Promise<Schedule[]> {
    return Array.from(this.schedules.values())
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }
  
  async publishSchedule(id: number): Promise<Schedule | undefined> {
    const schedule = await this.getSchedule(id);
    if (!schedule) return undefined;
    
    const now = new Date();
    const updatedSchedule: Schedule = {
      ...schedule,
      isPublished: true,
      publishedAt: now,
      updatedAt: now
    };
    
    this.schedules.set(id, updatedSchedule);
    return updatedSchedule;
  }
  
  // Shift management
  async createShift(shiftData: InsertShift): Promise<Shift> {
    const id = this.shiftCurrentId++;
    const shift: Shift = { ...shiftData, id };
    
    this.shifts.set(id, shift);
    return shift;
  }
  
  async getShifts(scheduleId: number): Promise<Shift[]> {
    return Array.from(this.shifts.values()).filter(
      (shift) => shift.scheduleId === scheduleId
    );
  }
  
  async getUserShifts(userId: number, scheduleId: number): Promise<Shift[]> {
    return Array.from(this.shifts.values()).filter(
      (shift) => shift.userId === userId && shift.scheduleId === scheduleId
    );
  }
  
  async updateShift(id: number, shiftData: Partial<InsertShift>): Promise<Shift | undefined> {
    const shift = this.shifts.get(id);
    if (!shift) return undefined;
    
    const updatedShift: Shift = { ...shift, ...shiftData };
    this.shifts.set(id, updatedShift);
    return updatedShift;
  }
  
  async deleteShift(id: number): Promise<boolean> {
    return this.shifts.delete(id);
  }
  
  /**
   * Elimina tutti i turni di uno schedule specifico
   * @param scheduleId - ID dello schedule da cui eliminare i turni
   * @returns true se l'operazione è riuscita, false altrimenti
   */
  async deleteAllShiftsForSchedule(scheduleId: number): Promise<boolean> {
    try {
      // Conta quanti turni esistevano prima
      const scheduleShifts = Array.from(this.shifts.values()).filter(
        shift => shift.scheduleId === scheduleId
      );
      const initialCount = scheduleShifts.length;
      
      if (initialCount === 0) {
        console.log(`Nessun turno da eliminare per lo schedule ID ${scheduleId}`);
        return true;
      }
      
      // Elimina tutti i turni
      let deletedCount = 0;
      for (const shift of scheduleShifts) {
        if (this.shifts.delete(shift.id)) {
          deletedCount++;
        }
      }
      
      // Verifica il risultato
      const success = deletedCount === initialCount;
      console.log(`✅ Pulizia schedule ID ${scheduleId}: eliminati ${deletedCount}/${initialCount} turni`);
      return success;
    } catch (error) {
      console.error(`❌ Errore nell'eliminazione dei turni per lo schedule ID ${scheduleId}:`, error);
      return false;
    }
  }
  
  /**
   * Elimina completamente uno schedule e tutti i suoi turni
   * @param id - ID dello schedule da eliminare
   * @returns true se l'operazione è riuscita, false altrimenti
   */
  async deleteSchedule(id: number): Promise<boolean> {
    try {
      // Prima elimina tutti i turni associati
      await this.deleteAllShiftsForSchedule(id);
      
      // Poi elimina lo schedule stesso
      const result = this.schedules.delete(id);
      
      console.log(`${result ? '✅' : '❌'} Schedule ID ${id} ${result ? 'eliminato' : 'non trovato o non eliminato'}`);
      return result;
    } catch (error) {
      console.error(`❌ Errore durante l'eliminazione dello schedule ID ${id}:`, error);
      return false;
    }
  }
  
  // TimeOff requests
  async createTimeOffRequest(requestData: InsertTimeOffRequest): Promise<TimeOffRequest> {
    const id = this.timeOffRequestCurrentId++;
    const now = new Date();
    const request: TimeOffRequest = {
      ...requestData,
      id,
      approvedBy: null,
      createdAt: now,
      updatedAt: now
    };
    
    this.timeOffRequests.set(id, request);
    return request;
  }
  
  async getTimeOffRequest(id: number): Promise<TimeOffRequest | undefined> {
    return this.timeOffRequests.get(id);
  }
  
  async getUserTimeOffRequests(userId: number): Promise<TimeOffRequest[]> {
    return Array.from(this.timeOffRequests.values()).filter(
      (request) => request.userId === userId
    );
  }
  
  async getPendingTimeOffRequests(): Promise<TimeOffRequest[]> {
    return Array.from(this.timeOffRequests.values()).filter(
      (request) => request.status === "pending"
    );
  }
  
  async getAllTimeOffRequests(): Promise<TimeOffRequest[]> {
    return Array.from(this.timeOffRequests.values());
  }
  
  async approveTimeOffRequest(id: number, approverId: number): Promise<TimeOffRequest | undefined> {
    const request = await this.getTimeOffRequest(id);
    if (!request) return undefined;
    
    const now = new Date();
    const updatedRequest: TimeOffRequest = {
      ...request,
      status: "approved",
      approvedBy: approverId,
      updatedAt: now
    };
    
    this.timeOffRequests.set(id, updatedRequest);
    return updatedRequest;
  }
  
  async rejectTimeOffRequest(id: number, approverId: number): Promise<TimeOffRequest | undefined> {
    const request = await this.getTimeOffRequest(id);
    if (!request) return undefined;
    
    const now = new Date();
    const updatedRequest: TimeOffRequest = {
      ...request,
      status: "rejected",
      approvedBy: approverId,
      updatedAt: now
    };
    
    this.timeOffRequests.set(id, updatedRequest);
    return updatedRequest;
  }
  
  // Documents
  async createDocument(documentData: InsertDocument): Promise<Document> {
    const id = this.documentCurrentId++;
    const now = new Date();
    const document: Document = {
      ...documentData,
      id,
      uploadedAt: now
    };
    
    this.documents.set(id, document);
    return document;
  }
  
  async getDocument(id: number): Promise<Document | undefined> {
    return this.documents.get(id);
  }
  
  async getUserDocuments(userId: number, type?: string): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(
      (document) => document.userId === userId && (!type || document.type === type)
    );
  }
  
  async getAllDocuments(type?: string): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(
      (document) => !type || document.type === type
    );
  }
  
  async deleteDocument(id: number): Promise<boolean> {
    return this.documents.delete(id);
  }
  
  // Notifications
  async createNotification(notificationData: InsertNotification): Promise<Notification> {
    const id = this.notificationCurrentId++;
    const now = new Date();
    const notification: Notification = {
      ...notificationData,
      id,
      createdAt: now
    };
    
    this.notifications.set(id, notification);
    return notification;
  }
  
  async getUserNotifications(userId: number): Promise<Notification[]> {
    return Array.from(this.notifications.values()).filter(
      (notification) => notification.userId === userId
    );
  }
  
  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    const notification = this.notifications.get(id);
    if (!notification) return undefined;
    
    const updatedNotification: Notification = {
      ...notification,
      isRead: true
    };
    
    this.notifications.set(id, updatedNotification);
    return updatedNotification;
  }
  
  async markAllUserNotificationsAsRead(userId: number): Promise<boolean> {
    const userNotifications = await this.getUserNotifications(userId);
    
    userNotifications.forEach(notification => {
      this.notifications.set(notification.id, {
        ...notification,
        isRead: true
      });
    });
    
    return true;
  }
  
  // Message management
  async createMessage(messageData: InsertMessage): Promise<Message> {
    const id = this.messageCurrentId++;
    const now = new Date();
    
    const message: Message = {
      id,
      fromUserId: messageData.fromUserId,
      toUserId: messageData.toUserId,
      subject: messageData.subject,
      content: messageData.content,
      relatedToShiftId: messageData.relatedToShiftId || null,
      isRead: false,
      createdAt: now
    };
    
    this.messages.set(id, message);
    return message;
  }
  
  async getMessage(id: number): Promise<Message | undefined> {
    return this.messages.get(id);
  }
  
  async getUserReceivedMessages(userId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => message.toUserId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  async getUserSentMessages(userId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => message.fromUserId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  async markMessageAsRead(id: number): Promise<Message | undefined> {
    const message = this.messages.get(id);
    
    if (!message) {
      return undefined;
    }
    
    const updatedMessage: Message = {
      ...message,
      isRead: true
    };
    
    this.messages.set(id, updatedMessage);
    return updatedMessage;
  }
  
  async deleteMessage(id: number): Promise<boolean> {
    return this.messages.delete(id);
  }
}

import { eq, and, lte, gte } from "drizzle-orm";
import { db } from "./db";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export class DatabaseStorage implements IStorage {
  sessionStore: any; // Usiamo any per evitare errori di tipo

  // Implementiamo deleteSchedule e deleteAllShiftsForSchedule per aderire all'interfaccia
  
  constructor() {
    // Create PostgreSQL session store
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
    
    // Create default users if they don't exist
    this.initializeDefaultUsers();
  }
  
  private async initializeDefaultUsers() {
    // Check if admin exists
    const adminExists = await this.getUserByUsername("admin");
    if (!adminExists) {
      await this.createUser({
        username: "admin",
        password: "davittorino2025@",
        name: "Admin",
        email: "admin@davittorino.it",
        role: "admin",
        position: null,
        phone: null,
        isActive: true
      });
    }
  }
  
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    const now = new Date();
    const newUser = {
      ...insertUser,
      lastLogin: now
    };
    
    const [user] = await db.insert(users).values(newUser).returning();
    return user;
  }
  
  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return user;
  }
  
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }
  
  async createSchedule(scheduleData: InsertSchedule): Promise<Schedule> {
    const now = new Date();
    const newSchedule = {
      ...scheduleData,
      isPublished: false,
      publishedAt: null,
      updatedAt: now
    };
    
    const [schedule] = await db.insert(schedules).values(newSchedule).returning();
    return schedule;
  }
  
  async getSchedule(id: number): Promise<Schedule | undefined> {
    const [schedule] = await db.select().from(schedules).where(eq(schedules.id, id));
    return schedule;
  }
  
  async getScheduleByDateRange(startDate: Date, endDate: Date): Promise<Schedule | undefined> {
    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];
    
    const [schedule] = await db
      .select()
      .from(schedules)
      .where(
        and(
          lte(schedules.startDate, formattedEndDate),
          gte(schedules.endDate, formattedStartDate)
        )
      );
    
    return schedule;
  }
  
  async getAllSchedules(): Promise<Schedule[]> {
    try {
      // Importa e usa l'operatore desc da drizzle-orm
      const { desc } = await import('drizzle-orm');
      
      const allSchedules = await db
        .select()
        .from(schedules)
        .orderBy(desc(schedules.startDate));
      
      return allSchedules;
    } catch (error) {
      console.error("Error in getAllSchedules:", error);
      return [];
    }
  }
  
  async publishSchedule(id: number): Promise<Schedule | undefined> {
    const now = new Date();
    
    const [schedule] = await db
      .update(schedules)
      .set({ isPublished: true, publishedAt: now })
      .where(eq(schedules.id, id))
      .returning();
    
    return schedule;
  }
  
  async createShift(shiftData: InsertShift): Promise<Shift> {
    const [shift] = await db.insert(shifts).values(shiftData).returning();
    return shift;
  }
  
  async getShifts(scheduleId: number): Promise<Shift[]> {
    return await db
      .select()
      .from(shifts)
      .where(eq(shifts.scheduleId, scheduleId));
  }
  
  async getUserShifts(userId: number, scheduleId: number): Promise<Shift[]> {
    return await db
      .select()
      .from(shifts)
      .where(
        and(
          eq(shifts.userId, userId),
          eq(shifts.scheduleId, scheduleId)
        )
      );
  }
  
  async updateShift(id: number, shiftData: Partial<InsertShift>): Promise<Shift | undefined> {
    const [shift] = await db
      .update(shifts)
      .set(shiftData)
      .where(eq(shifts.id, id))
      .returning();
    
    return shift;
  }
  
  async deleteShift(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(shifts)
        .where(eq(shifts.id, id));
      
      return !!result;
    } catch (error) {
      console.error(`Errore durante l'eliminazione del turno ID ${id}:`, error);
      return false;
    }
  }
  
  /**
   * Elimina tutti i turni collegati a uno schedule specifico
   * @param scheduleId - L'ID dello schedule di cui eliminare i turni
   * @returns true se l'operazione è riuscita, false altrimenti
   */
  async deleteAllShiftsForSchedule(scheduleId: number): Promise<boolean> {
    try {
      // Prima conta quanti turni ci sono per lo schedule
      const allShifts = await this.getShifts(scheduleId);
      const initialCount = allShifts.length;
      
      if (initialCount === 0) {
        console.log(`✅ Nessun turno da eliminare per lo schedule ID ${scheduleId}`);
        return true;
      }
      
      // Elimina tutti i turni per lo schedule specificato
      const result = await db
        .delete(shifts)
        .where(eq(shifts.scheduleId, scheduleId));
      
      console.log(`✅ Pulizia DB: eliminati tutti i turni per schedule ID ${scheduleId}`);
      return true;
    } catch (error) {
      console.error(`❌ Errore nell'eliminazione dei turni per lo schedule ID ${scheduleId}:`, error);
      return false;
    }
  }
  
  /**
   * Elimina completamente uno schedule e tutti i suoi turni
   * @param id - ID dello schedule da eliminare
   * @returns true se l'operazione è riuscita, false altrimenti
   */
  async deleteSchedule(id: number): Promise<boolean> {
    try {
      // Prima elimina tutti i turni associati
      await this.deleteAllShiftsForSchedule(id);
      
      // Poi elimina lo schedule stesso
      const result = await db
        .delete(schedules)
        .where(eq(schedules.id, id));
      
      console.log(`✅ Schedule ID ${id} eliminato completamente dal database`);
      return true;
    } catch (error) {
      console.error(`❌ Errore durante l'eliminazione dello schedule ID ${id}:`, error);
      return false;
    }
  }
  
  async createTimeOffRequest(requestData: InsertTimeOffRequest): Promise<TimeOffRequest> {
    const now = new Date();
    const newRequest = {
      ...requestData,
      createdAt: now,
      updatedAt: now,
      approvedBy: null
    };
    
    const [request] = await db.insert(timeOffRequests).values(newRequest).returning();
    return request;
  }
  
  async getTimeOffRequest(id: number): Promise<TimeOffRequest | undefined> {
    const [request] = await db
      .select()
      .from(timeOffRequests)
      .where(eq(timeOffRequests.id, id));
    
    return request;
  }
  
  async getUserTimeOffRequests(userId: number): Promise<TimeOffRequest[]> {
    return await db
      .select()
      .from(timeOffRequests)
      .where(eq(timeOffRequests.userId, userId));
  }
  
  async getPendingTimeOffRequests(): Promise<TimeOffRequest[]> {
    return await db
      .select()
      .from(timeOffRequests)
      .where(eq(timeOffRequests.status, "pending"));
  }
  
  async getAllTimeOffRequests(): Promise<TimeOffRequest[]> {
    return await db.select().from(timeOffRequests);
  }
  
  async approveTimeOffRequest(id: number, approverId: number): Promise<TimeOffRequest | undefined> {
    const now = new Date();
    
    const [request] = await db
      .update(timeOffRequests)
      .set({
        status: "approved",
        updatedAt: now,
        approvedBy: approverId
      })
      .where(eq(timeOffRequests.id, id))
      .returning();
    
    return request;
  }
  
  async rejectTimeOffRequest(id: number, approverId: number): Promise<TimeOffRequest | undefined> {
    const now = new Date();
    
    const [request] = await db
      .update(timeOffRequests)
      .set({
        status: "rejected",
        updatedAt: now,
        approvedBy: approverId
      })
      .where(eq(timeOffRequests.id, id))
      .returning();
    
    return request;
  }
  
  async createDocument(documentData: InsertDocument): Promise<Document> {
    const now = new Date();
    const newDocument = {
      ...documentData,
      uploadedAt: now
    };
    
    const [document] = await db
      .insert(documents)
      .values(newDocument)
      .returning();
    
    return document;
  }
  
  async getDocument(id: number): Promise<Document | undefined> {
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id));
    
    return document;
  }
  
  async getUserDocuments(userId: number, type?: string): Promise<Document[]> {
    let query = db
      .select()
      .from(documents)
      .where(eq(documents.userId, userId));
    
    if (type) {
      query = query.where(eq(documents.type, type));
    }
    
    return await query;
  }
  
  async getAllDocuments(type?: string): Promise<Document[]> {
    let query = db.select().from(documents);
    
    if (type) {
      query = query.where(eq(documents.type, type));
    }
    
    return await query;
  }
  
  async deleteDocument(id: number): Promise<boolean> {
    const result = await db
      .delete(documents)
      .where(eq(documents.id, id));
    
    return !!result;
  }
  
  async createNotification(notificationData: InsertNotification): Promise<Notification> {
    const now = new Date();
    const newNotification = {
      ...notificationData,
      createdAt: now,
      isRead: false
    };
    
    const [notification] = await db
      .insert(notifications)
      .values(newNotification)
      .returning();
    
    return notification;
  }
  
  async getUserNotifications(userId: number): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId));
  }
  
  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    const [notification] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    
    return notification;
  }
  
  async markAllUserNotificationsAsRead(userId: number): Promise<boolean> {
    const result = await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
    
    return !!result;
  }
  
  async createMessage(messageData: InsertMessage): Promise<Message> {
    const now = new Date();
    const newMessage = {
      ...messageData,
      createdAt: now,
      isRead: false
    };
    
    const [message] = await db
      .insert(messages)
      .values(newMessage)
      .returning();
    
    return message;
  }
  
  async getMessage(id: number): Promise<Message | undefined> {
    const [message] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, id));
    
    return message;
  }
  
  async getUserReceivedMessages(userId: number): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.receiverId, userId));
  }
  
  async getUserSentMessages(userId: number): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.senderId, userId));
  }
  
  async markMessageAsRead(id: number): Promise<Message | undefined> {
    const [message] = await db
      .update(messages)
      .set({ isRead: true })
      .where(eq(messages.id, id))
      .returning();
    
    return message;
  }
  
  async deleteMessage(id: number): Promise<boolean> {
    const result = await db
      .delete(messages)
      .where(eq(messages.id, id));
    
    return !!result;
  }
}

export const storage = new DatabaseStorage();
