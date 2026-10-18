import * as crypto from 'crypto';
import * as path from 'path';

export function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function isPathInsideDirectory(targetPath: string, baseDirectory: string): boolean {
  const relative = path.relative(path.resolve(baseDirectory), path.resolve(targetPath));
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

export function sanitizeGoalInput(input: string): string {
  return input.trim().slice(0, 1000);
}

export function sanitizeDescriptionInput(input: string): string {
  return input.trim().slice(0, 5000);
}
