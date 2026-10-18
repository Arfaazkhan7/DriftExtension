import * as crypto from 'crypto';
import * as path from 'path';

/**
 * Generate a cryptographically secure random nonce for Webview CSP.
 */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Verifies whether a given target path strictly resides within a base directory.
 * Prevents directory traversal attacks (e.g. "../../../etc/passwd").
 */
export function isPathInsideDirectory(targetPath: string, baseDirectory: string): boolean {
  const relative = path.relative(path.resolve(baseDirectory), path.resolve(targetPath));
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * Validates and sanitizes goal input string.
 */
export function sanitizeGoalInput(input: string): string {
  return input.trim().slice(0, 1000);
}

/**
 * Validates and sanitizes description input string.
 */
export function sanitizeDescriptionInput(input: string): string {
  return input.trim().slice(0, 5000);
}
