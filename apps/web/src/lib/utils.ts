/**
 * @fileoverview Tailwind CSS class-merge utility used by every UI primitive.
 * @layer lib
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS class names, deduplicating conflicting utilities.
 *
 * @param inputs - Any number of class values (strings, objects, arrays).
 * @returns Merged class string with Tailwind conflicts resolved.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
