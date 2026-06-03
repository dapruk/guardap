# Guardap Project Context

Guardap is a TypeScript authorization library focused on fluent, strongly typed access-control checks. The core is framework-agnostic and can run in sync, async, client, server, or SSR contexts. React bindings and router drivers sit on top of that core.

Current package version: `1.1.0`

## What The Library Does

Guardap models authorization around five typed domain concepts:

- `TRole`: user roles, for example `admin`, `staff`, `viewer`
- `TFeature`: protected resources/features, for example `posts`, `settings`
- `TAction`: actions on features, for example `create`, `read`, `update`, `delete`
- `TCondition`: dynamic boolean flags, for example `isVerified`, `hasSubscription`
- `TGroup`: named groups that map to roles, for example `staff`, `management`
- `TRoutePath`: optional route path union for typed redirects, defaulting to `string`

The public API starts with `createGuard(config)`. The config tells Guardap how to get user state, derive permissions from roles, resolve actions into permission codes, define role groups, and optionally redirect through a router driver.

The main style is a fluent chain:

```ts
Guard.requireRole('admin')
  .or()
  .requireRole('editor')
  .mustBe('active')
  .require('edit')
  .on('posts')
  .allowed();
```

Within a branch, checks are ANDed together. Calling `.or()` snapshots a successful previous branch and starts a new branch.

## Repository Structure

```txt
.
├── package.json
├── readme.md
├── tsconfig.json
├── tsup.config.ts
├── src
│   ├── index.ts
│   ├── core
│   │   ├── guard.ts
│   │   ├── meta.ts
│   │   └── types.ts
│   ├── drivers
│   │   ├── react-router.ts
│   │   ├── tanstack.ts
│   │   └── tanstack-router.ts
│   └── react
│       └── index.tsx
└── tests
    ├── core.test.ts
    ├── dx.test.ts
    ├── react-integration.test.tsx
    ├── react-suspense.test.tsx
    ├── react.test.tsx
    ├── type-improvements.test.ts
    └── v1-1.test.ts
```

There is also a checked-in `dist/` directory containing build output, plus `package-lock.json`.

## Core Types

File: `src/core/types.ts`

Important exported types:

- `RouterDriver`: a function `(url: string) => void`
- `PermissionValue`: `string | string[]`
- `PermissionMatrix<TFeature>`: partial record of feature names or `'*'` to permission values
- `GuardapRouteMeta`: typed route metadata matching fluent guard concepts
- `GuardapRoutePath`: resolves the route-path generic while preserving compatibility with older context-generic usage
- `GuardapConfigContext`: resolves the context generic when route paths are supplied
- `GuardapGuardLike`: structural type for guard instances that expose `.with(context)`
- `UserState`: user-facing state returned by `getUserState`
- `GuardContext`: normalized internal state used by `GuardBuilder`
- `GuardConfig`: main configuration object passed to `createGuard`
- `IGuardChain`: fluent chain interface

`UserState` requires:

```ts
{
  roles: TRole[];
  conditions: Partial<Record<TCondition, boolean>>;
  isAuthenticated?: boolean;
}
```

It is intersected with `TData`, so users can add custom fields. Internally, `createGuard` wraps this into `GuardContext` and stores the original user state under `data`.

Authentication is inferred as:

```ts
userState.isAuthenticated ?? userState.roles.length > 0
```

## Core Factory

File: `src/index.ts`

`createGuard` is the main exported function. It:

1. Fills `config.resolveAction` with a default resolver when missing.
2. Calls `config.getUserState(ctx)` whenever a new builder is created.
3. Supports either direct `UserState` or `Promise<UserState>`.
4. Computes permissions using `config.getPermissions(userState.roles)`.
5. Returns a public guard object with fluent entry points.

The default action resolver maps common action names to CRUD letters:

```txt
create/add -> c
read/view  -> r
update/edit -> u
delete/remove -> d
fallback -> first lowercase character
```

Public methods returned by `createGuard`:

- `with(context)`: creates a request/context-scoped builder
- `requireRole(role | roles)`
- `requireGroup(group | groups)`
- `requireLogin()`
- `guestOnly()`
- `mustBe(condition)`
- `require(action).on(feature)`
- `redirect(to?)`
- `can(action, feature, context?)`
- `permissions` getter

`can()` currently calls `.allowed()` synchronously, so it only works with synchronous `getUserState`.

The `permissions` getter also requires synchronous user state and throws if `getUserState` returns a promise.

The seventh generic slot on `createGuard` and `GuardConfig` can be an app route path union:

```ts
type AppRoutePath = '/' | '/login' | '/posts' | '/posts/:postId';

const Guard = createGuard<
  AppRole,
  AppFeature,
  AppAction,
  AppCondition,
  AppGroup,
  AppData,
  AppRoutePath
>(config);
```

That type flows into `defaultRedirect`, `redirects`, `RouterDriver`, and `.redirect(to?)`. The route-path generic defaults to `string`.

## Route Metadata Helpers

File: `src/core/meta.ts`

Guardap exposes a small shared metadata layer for router integrations without introducing a new authorization model.

`GuardapRouteMeta` supports:

- `login`
- `guest`
- `role`
- `group`
- `condition`
- `feature`
- `action`
- `redirectTo`

`applyGuardMeta(guard, meta, context?)` creates a fresh `guard.with(context)` chain and applies the fields in the same order as `AccessGuard` props.

`evaluateGuardMeta(guard, meta, context?)` evaluates that chain. It returns a boolean for sync guards and a promise for async guards.

`defineGuardRedirects<TRoutePath>()({...})` is a zero-runtime-shape helper for strict redirect map key/value typing. It is useful because TypeScript does not always excess-check nested object keys inside `satisfies GuardConfig`.

## Guard Builder Implementation

File: `src/core/guard.ts`

`GuardBuilder` stores:

- `config`: normalized guard config
- `context`: sync normalized guard context
- `promise`: async normalized guard context
- `isAllowed`: current branch status, initially `true`
- `wasPreviouslyAllowed`: whether an earlier OR branch passed
- `asyncOps`: queued chain operations to replay after async user state resolves

### Sync Behavior

For synchronous `getUserState`, checks execute immediately against `context`.

Each check first calls `shouldSkipCheck()`:

```ts
return this.wasPreviouslyAllowed || !this.isAllowed;
```

That means:

- If an earlier OR branch already passed, later checks are skipped.
- If the current branch has already failed, later AND checks are skipped.

`.allowed()` returns:

```ts
this.wasPreviouslyAllowed || this.isAllowed
```

### Async Behavior

If `getUserState` returns a `Promise`, the builder stores the promise and queues every fluent operation in `asyncOps`.

Calling `.allowed()` on an async builder throws:

```txt
[Guardap] Cannot call .allowed() on an async Guard. Use .allowedAsync() instead.
```

Calling `.allowedAsync()` awaits the context promise, creates a new sync builder, replays queued operations, and returns the sync builder's `.allowed()` result.

### Role Checks

`requireRole(role | roles)` passes if the user has at least one required role. Arrays are OR logic within that method.

### Group Checks

`requireGroup(group | groups)` looks up configured groups from `config.groups`, merges all roles for the requested groups into a set, and passes if the user has one of those roles.

If no group config exists, the check fails.

### Login Checks

`requireLogin()` passes when `context.isAuthenticated` is true.

`guestOnly()` passes when `context.isAuthenticated` is false.

### Condition Checks

`mustBe(condition)` passes only when:

```ts
context.conditions[condition] === true
```

Missing or false conditions fail.

### Permission Checks

`require(action).on(feature)` checks the computed permission matrix.

Supported permission forms:

- Global wildcard: `{ '*': '*' }`
- Feature wildcard as string: `{ settings: '*' }`
- Feature wildcard in array: `{ settings: ['*'] }`
- Compact string permission codes: `{ posts: 'crud' }`
- Action strings inside a string or array: `{ posts: ['create', 'read'] }`

Permission check flow:

1. Global wildcard passes immediately.
2. Feature wildcard passes immediately.
3. Missing feature permissions fail.
4. Missing `resolveAction` fails, though `createGuard` normally supplies one.
5. The action is resolved into a code.
6. The permission passes if `userPermissions.includes(reqCode)` or `userPermissions.includes(action)`.

Because `PermissionValue` is `string | string[]`, JavaScript `includes` works for compact strings and arrays.

### OR Logic

`.or()` works by:

1. Setting `wasPreviouslyAllowed = true` if the current branch is allowed.
2. Resetting `isAllowed = true` for the next branch.

Once `wasPreviouslyAllowed` is true, `shouldSkipCheck()` skips later checks and `.allowed()` stays true.

### Redirects

`.redirect(to?)` only works in sync mode. In async mode it warns and does nothing.

When access is denied, redirect target resolution is:

1. Use explicit `to`, otherwise `config.defaultRedirect`, otherwise `/`.
2. If `config.redirects[targetUrl]` exists, replace target with the mapped URL.
3. Call `config.router.driver(targetUrl)`.

If no router driver is configured, it warns.

### Debug Mode

If `config.debug` is true, failed checks call:

```ts
console.warn('[Guardap] Rejected: ...', details || '')
```

Tests cover role failure and missing feature permission logging.

## React Integration

File: `src/react/index.tsx`

The React entry exports its own `createGuard(config)` wrapper. It calls the core `createGuard(config)` and returns all core guard methods plus React helpers:

- `GuardProvider`
- `useGuard`
- `AccessGuard`
- `withAuth`

### GuardProvider

Creates a React context containing the bound guard instance.

Current implementation creates the guard instance once inside the React factory, so the provider does not accept a dynamic guard value.

### useGuard

Reads the guard from context. The context default is already the guard instance, so the `if (!context)` error path should rarely be reachable.

### AccessGuard Component

Props:

- `children`
- `fallback`
- `loadingComponent`
- `suspense`
- `login`
- `guest`
- `role`
- `group`
- `condition`
- `feature`
- `action`

The component builds a guard chain from props using AND logic between supplied props:

1. `login`
2. `guest`
3. `group`
4. `role`
5. `condition`
6. `feature` + `action`

For sync guards, it calls `.allowed()` and renders immediately after state is set.

For async guards without Suspense, it catches the `.allowed()` error, awaits `.allowedAsync()`, and renders `loadingComponent || fallback` while pending.

For async guards with `suspense={true}`, it throws the authorization promise so a parent `<Suspense>` boundary can render its fallback. Results are cached in a module-level `Map` keyed by the JSON string of guard props.

### withAuth HOC

`withAuth(Component, options)` wraps a component in `AccessGuard` with those options.

## Router Drivers

File: `src/drivers/react-router.ts`

`createReactRouterDriver(navigate)` adapts React Router's `navigate` function into a `RouterDriver`.

It also exports:

- `ReactRouterGuardHandle`
- `applyReactRouterGuardMeta`
- `evaluateReactRouterGuard`
- `defineReactRouterPaths`

File: `src/drivers/tanstack.ts`

`TanStackDriver` throws TanStack Router's `redirect({ to })`, matching TanStack loader-style redirect behavior.

It also exports:

- `TanStackGuardStaticData`
- `TanStackRoutePath`
- `applyTanStackGuardMeta`
- `evaluateTanStackGuard`
- `defineTanStackRouterPaths`

File: `src/drivers/tanstack-router.ts`

This is a compatibility re-export of `src/drivers/tanstack.ts`.

## Build And Package Configuration

File: `package.json`

Package exports:

- `guardap`
- `guardap/react`
- `guardap/drivers/react-router`
- `guardap/drivers/tanstack`

Runtime build targets:

- CommonJS: `dist/**/*.js`
- ESM: `dist/**/*.mjs`
- Types: `dist/**/*.d.ts`

Scripts:

- `npm run dev`: `tsup --watch`
- `npm run build`: `tsup`
- `npm test`: `vitest`
- `npm run format`: Prettier over source and tests
- `npm publish`: runs `prepublishOnly`, which builds first

File: `tsup.config.ts`

Build entries are configured as:

```ts
[
  'src/index.ts',
  'src/drivers/tanstack.ts',
  'src/drivers/react-router.ts',
  'src/react/index.tsx',
]
```

Externalized dependencies:

- `@tanstack/react-router`
- `react-router-dom`
- `react`

File: `tsconfig.json`

Important settings:

- `target`: `ES2020`
- `module`: `ESNext`
- `moduleResolution`: `node`
- `jsx`: `react-jsx`
- `strict`: `true`
- `declaration`: `true`
- `outDir`: `dist`
- path alias: `@/* -> src/*`
- `include`: `src`

## Tests

The test suite uses Vitest. React tests use Testing Library with `jsdom`.

Current test files cover:

- `tests/core.test.ts`: roles, permissions, groups, login/guest checks, OR logic, redirects
- `tests/v1-1.test.ts`: feature-level wildcards, async builder behavior, async OR replay
- `tests/dx.test.ts`: debug logging and synchronous hydration behavior
- `tests/router-helpers.test.ts`: route metadata typing, shared helper behavior, async evaluation, and router driver exports
- `tests/router-path-types.test.ts`: typed redirect paths, typed default redirects, strict redirect map helper, and typed React Router drivers
- `tests/type-improvements.test.ts`: readonly arrays, overloads, and custom `TData`
- `tests/react-integration.test.tsx`: current React factory pattern
- `tests/react.test.tsx`: older React async API shape
- `tests/react-suspense.test.tsx`: older React Suspense API shape

## Current Implementation Notes And Drift

These are important maintenance notes from the current repo state.

### TanStack Driver Filename Compatibility

The public package subpath remains:

```txt
guardap/drivers/tanstack
```

The build entry now has a matching source file:

```txt
src/drivers/tanstack.ts
```

`src/drivers/tanstack-router.ts` remains as a compatibility re-export.

### Older React Tests Reference Removed API

`tests/react.test.tsx` and `tests/react-suspense.test.tsx` import:

```ts
createReactAccessGuard
```

from `../src/react`, and expect:

```ts
AccessGuardProvider
```

The current `src/react/index.tsx` exports a factory named `createGuard`, returning `GuardProvider`, `AccessGuard`, `useGuard`, and `withAuth`.

Either those tests are stale, or compatibility exports need to be restored.

### React AccessGuard Always Uses `api.with(undefined as any)`

The React component builds chains via:

```ts
api.with(undefined as any)
```

This works for configs whose `getUserState` ignores the context, but it means `AccessGuard` does not currently expose a prop or provider mechanism for passing request/user context into the guard.

### Suspense Cache Is Global

The Suspense cache key only includes guard props:

```ts
{ login, guest, role, group, condition, feature, action }
```

It does not include guard instance identity, user state, or context. This is simple, but can leak stale decisions if multiple guard instances or changing user states share the same prop shape in one runtime.

### Async Redirects Are Manual

`.redirect()` is intentionally sync-only today. For async user state, callers need to await `.allowedAsync()` and redirect manually.

### `can()` Is Sync-Only

`guard.can(action, feature, context?)` always calls `.allowed()`. It will throw for async guards.

## Development Guidelines For Future Changes

- Keep the core framework-agnostic. React and router integrations should remain thin adapters around the core guard object.
- Add or update tests when changing chain semantics, async replay, permission matching, redirects, or React rendering states.
- Be careful when reusing a `GuardBuilder`: it is stateful. Tests often create a fresh `Guard.with(...)` per independent assertion.
- Preserve the typed generic flow from config to fluent methods and React props.
- Check package subpath exports whenever adding or renaming files under `src/drivers` or `src/react`.
- If changing async behavior, verify both `.allowedAsync()` and the React loading/Suspense flows.
