import assert from 'node:assert';
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { FileCollector } from '../../src/services/fileCollector';
import { shouldIgnoreDirectory, shouldIgnoreFile } from '../../src/utils/exclusions';
import { isPathInsideDirectory } from '../../src/utils/security';

describe('File Exclusion and Security Rules', () => {
  it('should identify canonical directories to ignore', () => {
    assert.strictEqual(shouldIgnoreDirectory('.git'), true);
    assert.strictEqual(shouldIgnoreDirectory('node_modules'), true);
    assert.strictEqual(shouldIgnoreDirectory('dist'), true);
    assert.strictEqual(shouldIgnoreDirectory('.venv'), true);
    assert.strictEqual(shouldIgnoreDirectory('__pycache__'), true);
    assert.strictEqual(shouldIgnoreDirectory('src'), false);
    assert.strictEqual(shouldIgnoreDirectory('components'), false);
  });

  it('should identify canonical extensions to ignore', () => {
    assert.strictEqual(shouldIgnoreFile('image.png'), true);
    assert.strictEqual(shouldIgnoreFile('audio.mp3'), true);
    assert.strictEqual(shouldIgnoreFile('app.exe'), true);
    assert.strictEqual(shouldIgnoreFile('library.dll'), true);
    assert.strictEqual(shouldIgnoreFile('bundle.js.map'), true);
    assert.strictEqual(shouldIgnoreFile('package-lock.json.lock'), true);
    assert.strictEqual(shouldIgnoreFile('script.py'), false);
    assert.strictEqual(shouldIgnoreFile('component.tsx'), false);
  });

  it('should strictly exclude secret and credential files', () => {
    assert.strictEqual(shouldIgnoreFile('.env'), true);
    assert.strictEqual(shouldIgnoreFile('.env.local'), true);
    assert.strictEqual(shouldIgnoreFile('.env.production'), true);
    assert.strictEqual(shouldIgnoreFile('server.key'), true);
    assert.strictEqual(shouldIgnoreFile('cert.pem'), true);
    assert.strictEqual(shouldIgnoreFile('id_rsa'), true);
    assert.strictEqual(shouldIgnoreFile('id_ed25519'), true);
    assert.strictEqual(shouldIgnoreFile('credentials.json'), true);
    assert.strictEqual(shouldIgnoreFile('secrets.json'), true);
    assert.strictEqual(shouldIgnoreFile('config.json'), false);
  });

  it('should enforce path boundary checks within workspace', () => {
    const root = path.resolve('/workspace/project');
    const inside = path.resolve('/workspace/project/src/index.ts');
    const outside = path.resolve('/workspace/other/file.ts');
    const escape = path.resolve('/workspace/project/../../etc/passwd');

    assert.strictEqual(isPathInsideDirectory(inside, root), true);
    assert.strictEqual(isPathInsideDirectory(outside, root), false);
    assert.strictEqual(isPathInsideDirectory(escape, root), false);
  });

  it('should collect only eligible files within a directory tree and respect maxFiles limit', async () => {
    const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'drift-test-collector-'));

    try {
      // Create test files
      await fsp.writeFile(path.join(tempDir, 'main.py'), 'print("hello")');
      await fsp.writeFile(path.join(tempDir, 'index.ts'), 'console.log(1)');
      await fsp.writeFile(path.join(tempDir, '.env'), 'SECRET=123');
      await fsp.writeFile(path.join(tempDir, 'logo.png'), 'binarydata');

      // Create ignored dir with file
      const gitDir = path.join(tempDir, '.git');
      await fsp.mkdir(gitDir);
      await fsp.writeFile(path.join(gitDir, 'config'), 'gitconfig');

      // Create subfolder with file
      const srcDir = path.join(tempDir, 'src');
      await fsp.mkdir(srcDir);
      await fsp.writeFile(path.join(srcDir, 'app.py'), 'def run(): pass');

      const collector = new FileCollector({ maxFiles: 10 });
      const collected = await collector.collectFiles(tempDir);

      const basenames = collected.map(f => path.basename(f)).sort();
      assert.deepStrictEqual(basenames, ['app.py', 'index.ts', 'main.py']);

      // Test maxFiles limit
      const limitedCollector = new FileCollector({ maxFiles: 2 });
      const limited = await limitedCollector.collectFiles(tempDir);
      assert.strictEqual(limited.length, 2);
    } finally {
      await fsp.rm(tempDir, { recursive: true, force: true });
    }
  });
});
