declare module 'nanoid' {
  export function nanoid(size?: number): string;
}

export interface User {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLogin?: Date | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface Shift {
  id: number;
  scheduleId: number;
  userId: number;
  day: string;
  startTime: string;
  endTime: string;
  type: string;
  notes?: string | null;
  area?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface Schedule {
  id: number;
  startDate: string;
  endDate: string;
  isPublished: boolean;
  publishedAt?: Date | string | null;
  createdBy: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface TimeOffRequest {
  id: number;
  userId: number;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
  reason?: string | null;
  reviewedBy?: number | null;
  reviewedAt?: Date | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface Document {
  id: number;
  userId: number;
  type: string;
  title: string;
  description?: string | null;
  fileUrl: string;
  period?: string | null;
  uploadedBy: number;
  uploadedAt?: Date | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface Notification {
  id: number;
  userId: number;
  type: string;
  message: string;
  isRead: boolean;
  data?: any;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface Message {
  id: number;
  fromUserId: number;
  toUserId: number;
  subject: string;
  content: string;
  isRead: boolean;
  relatedToShiftId?: number | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
} 