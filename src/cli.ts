#!/usr/bin/env node
import { access, mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';

export type InitTemplate = 'core' | 'react';
export type InitRouter = 'none' | 'react-router' | 'tanstack';

export interface InitOptions {
  template: InitTemplate;
  router: InitRouter;
  target: string;
  force: boolean;
}

export interface CliIO {
  cwd: string;
  stdin: NodeJS.ReadableStream;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
}

const defaultIo = (): CliIO => ({
  cwd: process.cwd(),
  stdin: process.stdin,
  stdout: process.stdout,
  stderr: process.stderr,
});

const helpText = `Guardap CLI

Usage:
  guardap init [options]
  guardap --help

Options:
  --template <core|react>          Config style to generate.
  --router <none|react-router|tanstack>
                                   Optional router wiring.
  --target <path>                  Output file path.
  --force                          Overwrite an existing target file.
  --yes                            Use defaults without prompts.
  -h, --help                       Show this help message.
`;

const isHelpFlag = (value: string) => value === '--help' || value === '-h';

const isTemplate = (value: string): value is InitTemplate =>
  value === 'core' || value === 'react';

const isRouter = (value: string): value is InitRouter =>
  value === 'none' || value === 'react-router' || value === 'tanstack';

const write = (stream: NodeJS.WritableStream, message: string) => {
  stream.write(message);
};

export const hasSrcDirectory = async (cwd: string) => {
  try {
    const src = await stat(resolve(cwd, 'src'));
    return src.isDirectory();
  } catch {
    return false;
  }
};

export const detectDefaultTarget = async (cwd: string) =>
  (await hasSrcDirectory(cwd)) ? 'src/guard.ts' : 'guard.ts';

const pathExists = async (path: string) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const parseFlagValue = (
  args: string[],
  index: number,
  flag: string,
): string => {
  const value = args[index + 1];
  if (!value || value.startsWith('-')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
};

export interface ParsedInitFlags {
  template?: InitTemplate;
  router?: InitRouter;
  target?: string;
  force: boolean;
  yes: boolean;
}

export const parseInitFlags = (args: string[]): ParsedInitFlags => {
  const flags: ParsedInitFlags = {
    force: false,
    yes: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--template') {
      const value = parseFlagValue(args, index, arg);
      if (!isTemplate(value)) {
        throw new Error(`Invalid --template "${value}". Use core or react.`);
      }
      flags.template = value;
      index += 1;
      continue;
    }

    if (arg === '--router') {
      const value = parseFlagValue(args, index, arg);
      if (!isRouter(value)) {
        throw new Error(
          `Invalid --router "${value}". Use none, react-router, or tanstack.`,
        );
      }
      flags.router = value;
      index += 1;
      continue;
    }

    if (arg === '--target') {
      flags.target = parseFlagValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === '--force') {
      flags.force = true;
      continue;
    }

    if (arg === '--yes') {
      flags.yes = true;
      continue;
    }

    if (isHelpFlag(arg)) {
      continue;
    }

    throw new Error(`Unknown option "${arg}".`);
  }

  return flags;
};

const promptChoice = async <TValue extends string>(
  rl: ReturnType<typeof createInterface>,
  question: string,
  choices: readonly TValue[],
  fallback: TValue,
  output: NodeJS.WritableStream,
): Promise<TValue> => {
  const answer = (await rl.question(question)).trim();
  if (!answer) return fallback;
  if (choices.includes(answer as TValue)) return answer as TValue;

  write(
    output,
    `Please enter one of: ${choices.join(', ')}. Using ${fallback}.\n`,
  );
  return fallback;
};

const promptText = async (
  rl: ReturnType<typeof createInterface>,
  question: string,
  fallback: string,
) => {
  const answer = (await rl.question(question)).trim();
  return answer || fallback;
};

export const resolveInitOptions = async (
  flags: ParsedInitFlags,
  io: CliIO = defaultIo(),
): Promise<InitOptions> => {
  const defaultTarget = await detectDefaultTarget(io.cwd);

  if (flags.yes) {
    return {
      template: flags.template ?? 'react',
      router: flags.router ?? 'none',
      target: flags.target ?? defaultTarget,
      force: flags.force,
    };
  }

  const rl = createInterface({
    input: io.stdin,
    output: io.stdout,
  });

  try {
    const template =
      flags.template ??
      (await promptChoice(
        rl,
        'Template (core/react) [react]: ',
        ['core', 'react'] as const,
        'react',
        io.stdout,
      ));

    const router =
      flags.router ??
      (await promptChoice(
        rl,
        'Router (none/react-router/tanstack) [none]: ',
        ['none', 'react-router', 'tanstack'] as const,
        'none',
        io.stdout,
      ));

    const target =
      flags.target ??
      (await promptText(rl, `Target file [${defaultTarget}]: `, defaultTarget));

    return {
      template,
      router,
      target,
      force: flags.force,
    };
  } finally {
    rl.close();
  }
};

const routerImports = (router: InitRouter) => {
  if (router === 'react-router') {
    return `import {
  createReactRouterDriver,
  defineReactRouterRoutes,
} from 'guardap/drivers/react-router';
`;
  }

  if (router === 'tanstack') {
    return `import { createTanStackRouterDriver } from 'guardap/drivers/tanstack';
`;
  }

  return '';
};

const reactRouterSnippet = `const routes = defineReactRouterRoutes([
  {
    path: '/',
    children: [
      { index: true },
      { path: 'login' },
      { path: 'dashboard' },
    ],
  },
] as const);

// In React components, create the router driver with useNavigate():
// const navigate = useNavigate();
// const router = { driver: createReactRouterDriver(navigate, routes) };
`;

const tanstackRouterSnippet = `// Pass your app router to createTanStackRouterDriver:
// import { router } from './router';
// const routerDriver = createTanStackRouterDriver(router);
`;

const routerSnippet = (router: InitRouter) => {
  if (router === 'react-router') return reactRouterSnippet;
  if (router === 'tanstack') return tanstackRouterSnippet;
  return '';
};

const routerConfigSnippet = (router: InitRouter) => {
  if (router === 'react-router') {
    return `  // Uncomment once navigate is available in your app setup.
  // router,
`;
  }

  if (router === 'tanstack') {
    return `  // Uncomment once routerDriver is wired to your TanStack router.
  // router: { driver: routerDriver },
`;
  }

  return '';
};

const domainTypes = `type AppRole = 'admin' | 'user';
type AppFeature = 'dashboard' | 'settings';
type AppAction = 'create' | 'read' | 'update' | 'delete';
type AppCondition = 'isActive' | 'emailVerified';
type AppGroup = 'staff';
`;

const configBody = (router: InitRouter) => `${routerSnippet(router)}
const config = {
  groups: {
    staff: ['admin'],
  },

  getPermissions: (roles: AppRole[]) => {
    if (roles.includes('admin')) return { '*': '*' };
    if (roles.includes('user')) return { dashboard: 'r' };
    return {};
  },

  getUserState: () => {
    // Replace this with your auth/session source.
    return {
      roles: [] as AppRole[],
      conditions: {
        isActive: false,
        emailVerified: false,
      },
      isAuthenticated: false,
    };
  },

  defaultRedirect: '/login',
${routerConfigSnippet(router)}  debug: false,
} satisfies GuardConfig<
  AppRole,
  AppFeature,
  AppAction,
  AppCondition,
  AppGroup
>;
`;

const coreTemplate = (
  router: InitRouter,
) => `import { createGuard, type GuardConfig } from 'guardap';
${routerImports(router)}
${domainTypes}
${configBody(router)}
export const AccessGuard = createGuard(config);

// Usage:
// AccessGuard.requireLogin().redirect('/login');
// AccessGuard.require('read').on('dashboard').allowed();
`;

const reactTemplate = (
  router: InitRouter,
) => `import type { GuardConfig } from 'guardap';
import { createGuard } from 'guardap/react';
${routerImports(router)}
${domainTypes}
${configBody(router)}
export const { GuardProvider, AccessGuard, useGuard, withAuth } =
  createGuard(config);

// Usage:
// <GuardProvider>
//   <AccessGuard role="admin" fallback={null}>
//     <Dashboard />
//   </AccessGuard>
// </GuardProvider>
`;

export const renderGuardConfig = (options: InitOptions) =>
  options.template === 'core'
    ? coreTemplate(options.router)
    : reactTemplate(options.router);

export const writeGuardConfig = async (
  options: InitOptions,
  io: CliIO = defaultIo(),
) => {
  const target = resolve(io.cwd, options.target);

  if (!options.force && (await pathExists(target))) {
    throw new Error(
      `${options.target} already exists. Re-run with --force to overwrite it.`,
    );
  }

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, renderGuardConfig(options));
  return target;
};

const runInit = async (args: string[], io: CliIO) => {
  if (args.some(isHelpFlag)) {
    write(io.stdout, helpText);
    return 0;
  }

  const flags = parseInitFlags(args);
  const options = await resolveInitOptions(flags, io);
  const target = await writeGuardConfig(options, io);

  write(io.stdout, `Created ${target}\n`);
  return 0;
};

export const runCli = async (
  argv = process.argv.slice(2),
  io: CliIO = defaultIo(),
) => {
  const [command, ...args] = argv;

  try {
    if (!command || isHelpFlag(command)) {
      write(io.stdout, helpText);
      return 0;
    }

    if (command !== 'init') {
      write(io.stderr, `Unknown command "${command}".\n\n${helpText}`);
      return 1;
    }

    return await runInit(args, io);
  } catch (error) {
    write(
      io.stderr,
      `${error instanceof Error ? error.message : String(error)}\n\n${helpText}`,
    );
    return 1;
  }
};

const isDirectRun = () => {
  return (
    typeof require !== 'undefined' &&
    typeof module !== 'undefined' &&
    require.main === module
  );
};

if (isDirectRun()) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
