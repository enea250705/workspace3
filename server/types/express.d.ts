import { Express } from "express-serve-static-core";

declare global {
  namespace Express {
    interface Request {
      user: Record<string, any>;
      isAuthenticated(): boolean;
      logout(callback: (err: Error) => void): void;
    }
  }
}

export {}; 