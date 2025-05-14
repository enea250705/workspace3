import { nanoid } from 'nanoid';

/**
 * Generates a unique ID for database entities
 * @returns {string} A unique ID
 */
export function generateUniqueId(): string {
  return nanoid();
}

/**
 * Generates a numeric unique ID
 * @returns {number} A unique numeric ID based on timestamp
 */
export function generateNumericId(): number {
  return Date.now() + Math.floor(Math.random() * 1000);
} 