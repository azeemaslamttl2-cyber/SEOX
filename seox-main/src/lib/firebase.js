/**
 * Firebase stub module.
 * All Firebase functionality has been removed.
 * This module provides no-op implementations to satisfy existing imports.
 */

// Dummy objects to satisfy imports
export const firebaseApp = null;
export const auth = null;
export const db = null;

/**
 * Track a custom analytics event (no-op).
 * Kept for backward compatibility with existing code.
 */
export function track(eventName, params = {}) {
  // Analytics disabled - Firebase removed
}

export function getAnalyticsInstance() {
  return null;
}
