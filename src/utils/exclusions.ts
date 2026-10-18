import * as path from 'path';

/**
 * Maximum file size (in bytes) read into memory for drift analysis.
 * Files larger than 1MB are skipped to prevent memory exhaustion and event loop lag.
 */
export const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1MB

/**
 * Standard ignored directories across source control, dependencies, build targets,
 * virtual environments, and caches.
 */
export const CANONICAL_IGNORE_DIRECTORIES: ReadonlySet<string> = new Set([
  // Version Control
  '.git',
  '.svn',
  '.hg',
  // Package Managers & Dependencies
  'node_modules',
  'bower_components',
  'vendor',
  // Build Outputs & Compilers
  'dist',
  'build',
  'out',
  'target',
  'bin',
  'obj',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  // Virtual Environments & Python
  '.venv',
  'venv',
  'env',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.tox',
  // Coverage & Test Output
  'coverage',
  '.nyc_output',
  // IDEs
  '.idea',
  '.vs',
]);

/**
 * Standard ignored file extensions (binaries, media, archives, compiled artifacts, fonts).
 */
export const CANONICAL_IGNORE_EXTENSIONS: ReadonlySet<string> = new Set([
  // Images & Media
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.svg',
  '.webp',
  '.mp4',
  '.mp3',
  '.wav',
  '.ogg',
  '.mov',
  '.avi',
  '.pdf',
  // Archives & Executables
  '.zip',
  '.tar',
  '.gz',
  '.7z',
  '.rar',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.bin',
  // Compiled bytecodes
  '.pyc',
  '.pyo',
  '.class',
  // Fonts
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.otf',
  // Source maps & lock files
  '.map',
  '.lock',
]);

/**
 * Patterns matching potential secrets, credentials, and private keys.
 * These files are strictly excluded from code extraction and similarity analysis.
 */
export const SECRET_FILE_PATTERNS: ReadonlyArray<RegExp> = [
  /^\.env(\..+)?$/i,
  /\.(pem|key|cert|crt|p12|pfx|pkcs12)$/i,
  /^(id_rsa|id_ed25519|id_ecdsa)$/i,
  /^(credentials|secrets|tokens)\.json$/i,
];

export const VENV_DIR_PATTERN: RegExp =
  /^(.*[._-])?(venv|virtualenv|conda)([0-9._-].*)?$|^(.*[._-])?env([0-9._-].*)?$|^myenv$|^pyenv$|^venv$|^env$|^\.venv$|^\.env$|^site-packages$/i;

/**
 * Checks if a directory name matches canonical ignore rules or virtual environment patterns.
 */
export function shouldIgnoreDirectory(dirName: string, customIgnores?: Set<string>): boolean {
  if (CANONICAL_IGNORE_DIRECTORIES.has(dirName) || VENV_DIR_PATTERN.test(dirName)) {
    return true;
  }
  if (customIgnores && customIgnores.has(dirName)) {
    return true;
  }
  return false;
}

/**
 * Checks if a file should be ignored based on extension, secrets, or custom rules.
 */
export function shouldIgnoreFile(fileName: string, customIgnores?: Set<string>): boolean {
  const ext = path.extname(fileName).toLowerCase();
  if (CANONICAL_IGNORE_EXTENSIONS.has(ext)) {
    return true;
  }
  if (customIgnores && customIgnores.has(ext)) {
    return true;
  }
  // Secret checking
  const baseName = path.basename(fileName);
  for (const pattern of SECRET_FILE_PATTERNS) {
    if (pattern.test(baseName)) {
      return true;
    }
  }
  return false;
}
