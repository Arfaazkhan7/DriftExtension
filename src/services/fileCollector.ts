import * as fsp from 'fs/promises';
import * as path from 'path';
import {
  MAX_FILE_SIZE_BYTES,
  shouldIgnoreDirectory,
  shouldIgnoreFile,
} from '../utils/exclusions';
import { isPathInsideDirectory } from '../utils/security';

export interface FileCollectorOptions {
  maxFiles?: number;
  maxFileSizeBytes?: number;
  customIgnoreDirs?: Set<string>;
  customIgnoreExts?: Set<string>;
}

export class FileCollector {
  private readonly maxFiles: number;
  private readonly maxFileSizeBytes: number;
  private readonly customIgnoreDirs?: Set<string>;
  private readonly customIgnoreExts?: Set<string>;

  constructor(options?: FileCollectorOptions) {
    this.maxFiles = options?.maxFiles ?? 500;
    this.maxFileSizeBytes = options?.maxFileSizeBytes ?? MAX_FILE_SIZE_BYTES;
    this.customIgnoreDirs = options?.customIgnoreDirs;
    this.customIgnoreExts = options?.customIgnoreExts;
  }

  public async collectFiles(projectRoot: string): Promise<string[]> {
    const resolvedRoot = path.resolve(projectRoot);
    const results: string[] = [];
    const visitedDirs = new Set<string>();

    const walk = async (currentDir: string): Promise<void> => {
      if (results.length >= this.maxFiles) {
        return;
      }

      if (!isPathInsideDirectory(currentDir, resolvedRoot) && currentDir !== resolvedRoot) {
        return;
      }

      let realDirPath: string;
      try {
        realDirPath = await fsp.realpath(currentDir);
      } catch {
        return;
      }

      if (visitedDirs.has(realDirPath)) {
        return;
      }
      visitedDirs.add(realDirPath);

      let entries: import('fs').Dirent[];
      try {
        entries = await fsp.readdir(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (results.length >= this.maxFiles) {
          return;
        }

        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          if (!shouldIgnoreDirectory(entry.name, this.customIgnoreDirs)) {
            try {
              await fsp.access(path.join(fullPath, 'pyvenv.cfg'));
              continue; // Skip virtual environment directory
            } catch {
            }
            await walk(fullPath);
          }
          continue;
        }

        if (entry.isSymbolicLink()) {
          try {
            const stat = await fsp.stat(fullPath);
            if (stat.isDirectory()) {
              if (!shouldIgnoreDirectory(entry.name, this.customIgnoreDirs)) {
                try {
                  await fsp.access(path.join(fullPath, 'pyvenv.cfg'));
                  continue;
                } catch {
                }
                await walk(fullPath);
              }
              continue;
            }
          } catch {
            continue;
          }
        }

        if (shouldIgnoreFile(entry.name, this.customIgnoreExts)) {
          continue;
        }

        try {
          const stat = await fsp.stat(fullPath);
          if (stat.size <= this.maxFileSizeBytes) {
            results.push(fullPath);
          }
        } catch {
        }
      }
    };

    await walk(resolvedRoot);
    return results;
  }
}
