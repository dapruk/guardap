import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli, type CliIO } from '../src/cli';

const tempDirs: string[] = [];

const createTempDir = async () => {
  const dir = await mkdtemp(join(tmpdir(), 'guardap-cli-'));
  tempDirs.push(dir);
  return dir;
};

const createOutput = () => {
  let value = '';
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      value += chunk.toString();
      callback();
    },
  });

  return {
    stream,
    read: () => value,
  };
};

const createIo = (cwd: string) => {
  const stdout = createOutput();
  const stderr = createOutput();

  return {
    io: {
      cwd,
      stdin: Readable.from([]),
      stdout: stdout.stream,
      stderr: stderr.stream,
    } satisfies CliIO,
    stdout,
    stderr,
  };
};

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe('guardap init CLI', () => {
  it('uses src/guard.ts by default when src exists', async () => {
    const cwd = await createTempDir();
    await mkdir(join(cwd, 'src'));
    const { io } = createIo(cwd);

    const code = await runCli(['init', '--yes'], io);
    const output = await readFile(join(cwd, 'src/guard.ts'), 'utf8');

    expect(code).toBe(0);
    expect(output).toContain("import { createGuard } from 'guardap/react';");
    expect(output).toContain('GuardProvider');
  });

  it('uses guard.ts by default when src is missing', async () => {
    const cwd = await createTempDir();
    const { io } = createIo(cwd);

    const code = await runCli(['init', '--yes'], io);

    expect(code).toBe(0);
    await expect(readFile(join(cwd, 'guard.ts'), 'utf8')).resolves.toContain(
      'type AppRole',
    );
  });

  it('generates a core template', async () => {
    const cwd = await createTempDir();
    const { io } = createIo(cwd);

    const code = await runCli(
      ['init', '--template', 'core', '--target', 'auth/guard.ts', '--yes'],
      io,
    );
    const output = await readFile(join(cwd, 'auth/guard.ts'), 'utf8');

    expect(code).toBe(0);
    expect(output).toContain(
      "import { createGuard, type GuardConfig } from 'guardap';",
    );
    expect(output).toContain('export const AccessGuard = createGuard(config);');
    expect(output).not.toContain('GuardProvider');
  });

  it('generates React Router wiring snippets', async () => {
    const cwd = await createTempDir();
    const { io } = createIo(cwd);

    await runCli(
      ['init', '--router', 'react-router', '--target', 'guard.ts', '--yes'],
      io,
    );
    const output = await readFile(join(cwd, 'guard.ts'), 'utf8');

    expect(output).toContain('defineReactRouterRoutes');
    expect(output).toContain('createReactRouterDriver(navigate, routes)');
  });

  it('generates TanStack Router wiring snippets', async () => {
    const cwd = await createTempDir();
    const { io } = createIo(cwd);

    await runCli(
      ['init', '--router', 'tanstack', '--target', 'guard.ts', '--yes'],
      io,
    );
    const output = await readFile(join(cwd, 'guard.ts'), 'utf8');

    expect(output).toContain('createTanStackRouterDriver');
    expect(output).toContain('routerDriver');
  });

  it('refuses to overwrite an existing file without --force', async () => {
    const cwd = await createTempDir();
    await writeFile(join(cwd, 'guard.ts'), 'keep me');
    const { io, stderr } = createIo(cwd);

    const code = await runCli(['init', '--target', 'guard.ts', '--yes'], io);

    expect(code).toBe(1);
    expect(stderr.read()).toContain('already exists');
    await expect(readFile(join(cwd, 'guard.ts'), 'utf8')).resolves.toBe(
      'keep me',
    );
  });

  it('overwrites an existing file with --force', async () => {
    const cwd = await createTempDir();
    await writeFile(join(cwd, 'guard.ts'), 'replace me');
    const { io } = createIo(cwd);

    const code = await runCli(
      ['init', '--target', 'guard.ts', '--force', '--yes'],
      io,
    );
    const output = await readFile(join(cwd, 'guard.ts'), 'utf8');

    expect(code).toBe(0);
    expect(output).toContain('satisfies GuardConfig');
    expect(output).not.toBe('replace me');
  });

  it('returns an error for invalid flags and commands', async () => {
    const cwd = await createTempDir();
    const invalidFlag = createIo(cwd);
    const invalidCommand = createIo(cwd);

    await expect(
      runCli(['init', '--template', 'vue'], invalidFlag.io),
    ).resolves.toBe(1);
    await expect(runCli(['setup'], invalidCommand.io)).resolves.toBe(1);

    expect(invalidFlag.stderr.read()).toContain('Invalid --template');
    expect(invalidCommand.stderr.read()).toContain('Unknown command');
  });
});
