import * as path from 'path';

export const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1MB

export const CANONICAL_IGNORE_DIRECTORIES: ReadonlySet<string> = new Set([
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  'bower_components',
  'vendor',
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
  '.venv',
  'venv',
  'env',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.tox',
  'coverage',
  '.nyc_output',
  '.idea',
  '.vs',
]);

export const CANONICAL_IGNORE_EXTENSIONS: ReadonlySet<string> = new Set([
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
  '.pyc',
  '.pyo',
  '.class',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.otf',
  '.map',
  '.lock',
]);

export const SECRET_FILE_PATTERNS: ReadonlyArray<RegExp> = [
  /^\.env(\..+)?$/i,
  /\.(pem|key|cert|crt|p12|pfx|pkcs12)$/i,
  /^(id_rsa|id_ed25519|id_ecdsa)$/i,
  /^(credentials|secrets|tokens)\.json$/i,
];

export const VENV_DIR_PATTERN: RegExp =
  /^(.*[._-])?(venv|virtualenv|conda)([0-9._-].*)?$|^(.*[._-])?env([0-9._-].*)?$|^myenv$|^pyenv$|^venv$|^env$|^\.venv$|^\.env$|^site-packages$/i;

export function shouldIgnoreDirectory(dirName: string, customIgnores?: Set<string>): boolean {
  if (CANONICAL_IGNORE_DIRECTORIES.has(dirName) || VENV_DIR_PATTERN.test(dirName)) {
    return true;
  }
  if (customIgnores && customIgnores.has(dirName)) {
    return true;
  }
  return false;
}

export function shouldIgnoreFile(fileName: string, customIgnores?: Set<string>): boolean {
  const ext = path.extname(fileName).toLowerCase();
  if (CANONICAL_IGNORE_EXTENSIONS.has(ext)) {
    return true;
  }
  if (customIgnores && customIgnores.has(ext)) {
    return true;
  }
  const baseName = path.basename(fileName);
  for (const pattern of SECRET_FILE_PATTERNS) {
    if (pattern.test(baseName)) {
      return true;
    }
  }
  return false;
}
