# Guardap

A strictly typed, framework-agnostic authorization library for TypeScript.

## Core Values

### Type Safety Inheritance
Guardap utilizes a generic-first architecture where Roles, Features, Actions, and Conditions are defined once in the configuration and flow seamlessly to logic builders and React props. The entire authorization chain is statically verified, ensuring that invalid roles or actions are caught at compile time.

### Readable Fluent API
Complex authorization logic is transformed into readable, sequential sentences. The builder pattern supports standard AND logic by default, with branching OR logic available via `.or()`. This approach eliminates nested conditionals and improves code maintainability.

### Hybrid RBAC & ABAC
The system supports checking static Roles and Groups alongside dynamic boolean Conditions (State-based) within the same chain. It features granular control with Feature-Level Wildcards (`*`), allowing for flexible permission modeling that adapts to complex business rules.

### React First, Framework Agnostic
The core logic is pure TypeScript, making it Isomorphic and SSR-ready. First-class React bindings are provided, including native support for React Suspense to handle asynchronous authorization states without boilerplate loading logic.

## Comparison

**Standard Implementation**
```typescript
// Manual checks often lead to nested, hard-to-read logic
if (
  user.roles.includes('admin') || 
  (user.roles.includes('staff') && user.conditions.isActive)
) {
  return <AdminPanel />;
}
```

**Guardap Implementation**
```typescript
// Fluent, readable, and type-safe
if (
  AccessGuard.requireRole('admin')
    .or()
    .requireRole('staff')
    .mustBe('isActive')
    .allowed()
) {
  return <AdminPanel />;
}
```

---

## Usage Guide

### Installation

```bash
npm install guardap
# or
pnpm add guardap
```

### Core Configuration

The `createGuard` factory is the entry point. It accepts 5 generic types to enforce strict type safety across your application.

```typescript
import { createGuard } from 'guardap';

// 1. Define your Domain Types
type Roles = 'admin' | 'editor' | 'viewer';
type Features = 'posts' | 'settings';
type Actions = 'create' | 'read' | 'update' | 'delete';
type Conditions = 'isVerified' | 'hasSubscription';
type Groups = 'staff';

// 2. Create the Guard Instance
const AccessGuard = createGuard<Roles, Features, Actions, Conditions, Groups>({
  // Map roles to permissions
  getPermissions: (roles) => {
    if (roles.includes('admin')) return { '*': '*' }; // Global Wildcard
    if (roles.includes('editor')) return { posts: '*', settings: 'r' }; // Feature Wildcard
    return { posts: 'r' };
  },

  // Define Groups (Optional)
  groups: {
    staff: ['admin', 'editor'],
  },

  // Resolve current user state (Sync or Async)
  // This can return a direct object OR a Promise
  getUserState: async () => {
    // Example: Fetch from session or context
    const session = await fetchSession(); 
    return {
      roles: session.roles,
      conditions: { 
        isVerified: session.emailVerified,
        hasSubscription: !!session.subId 
      },
      // Explicit auth flag (optional, defaults to roles.length > 0)
      isAuthenticated: !!session.user,
    };
  },
  
  // Optional: Custom Action Resolver (Default: first char, e.g. 'create' -> 'c')
  resolveAction: (action) => action[0], 

  // Optional: Enable Debug Mode to log permission rejections to console
  debug: true,
});
```

### Core Logic

The `AccessGuard` instance provides a fluent builder for checking permissions.

**Synchronous Checks (Client)**
```typescript
// Uses default/global state
const isAllowed = AccessGuard.requireRole('admin')
  .require('create').on('posts')
  .allowed();
```

**Asynchronous Checks (Server)**
```typescript
// Injects request context
const isAllowed = await AccessGuard.with(context)
  .requireRole('admin')
  .allowedAsync();
```

**Complex Logic (.or)**
```typescript
AccessGuard.requireRole('admin')    // Check A
  .or()                       // OR
  .requireRole('editor')      // (Check B
  .mustBe('isVerified')       //  AND Check C)
  .allowed();
```

### Initialization Patterns

Guardap supports two initialization patterns depending on your environment.

**1. Client-Side (Implicit Context)**
In a client-side app (SPA), your user state is often global or retrieved from a store/hook. You don't need to pass context every time.

```typescript
// Config: getUserState uses global store or default logic
const isAllowed = AccessGuard.requireRole('admin').allowed();
```

**2. Server-Side (Explicit Context)**
In SSR or Middleware (Node/Next.js), state is request-scoped. Use `.with(context)` to inject the specific request context.

```typescript
// Config: getUserState(ctx) uses the passed context
const isAllowed = await AccessGuard.with(req).requireRole('admin').allowedAsync();
```

### The Fluent API

The `IGuardChain` interface provides a readable, sentence-like API.

| Method | Description |
| :--- | :--- |
| `requireRole(role)` | Checks if user has a specific role (or one of an array of roles). |
| `requireGroup(group)` | Checks if user belongs to a configured group. |
| `requireLogin()` | Enforces that the user is authenticated. |
| `guestOnly()` | Enforces that the user is NOT authenticated. |
| `mustBe(condition)` | Checks a custom boolean condition defined in `getUserState`. |
| `require(action).on(feature)` | Checks specific permission. Supports wildcards (`*`). |
| `.or()` | **Logic Switcher**. Snapshots the current chain result and resets for a new branch. (A || B). |
| `.allowed()` | **Terminal**. Returns `boolean`. Throws error if the chain is async. |
| `.allowedAsync()` | **Terminal**. Returns `Promise<boolean>`. Works for both sync and async chains. |
| `.redirect(to?)` | **Terminal**. Triggers the configured router driver if access is denied. |

**Example: Branching Logic**
```typescript
AccessGuard.requireRole('admin')    // Branch 1
  .or()                       // OR
  .requireRole('editor')      // Branch 2 (Start)
  .mustBe('isVerified')       // Branch 2 (Continue - AND)
  .allowed();
```

### React Integration

Guardap provides a powerful React adapter with full TypeScript support.

**1. Create the Instance**
```typescript
// src/guard.ts
import { createGuard } from 'guardap/react';

// Create your guard and export the bound components
export const { GuardProvider, AccessGuard, useGuard, withAuth } = createGuard(config);
```

**2. Wrap your App**
```tsx
// src/App.tsx
import { GuardProvider } from './guard';

<GuardProvider>
  <AppContent />
</GuardProvider>
```

**3. Protect Components (AccessGuard)**
The `AccessGuard` component accepts props that mirror the fluent API. All props are evaluated with **AND** logic.

```tsx
<AccessGuard
  role={['admin', 'editor']} // OR logic within role array
  condition="isVerified"     // AND condition
  fallback={<ForbiddenPage />}
  loadingComponent={<Spinner />} // Shown during async checks
>
  <ProtectedContent />
</AccessGuard>
```

**4. Protect Components (HOC)**
Wrap components directly using `withAuth`.

```tsx
const AdminPanel = withAuth(Dashboard, { role: 'admin' });
```

**5. Suspense Support (Experimental)**
Enable `suspense={true}` to let a parent `<Suspense>` boundary handle the loading state.

```tsx
<Suspense fallback={<GlobalSkeleton />}>
  <AccessGuard role="admin" suspense={true}>
    <AsyncProtectedContent />
  </AccessGuard>
</Suspense>
```

### Router Drivers

Guardap comes with built-in drivers for popular routers.

**React Router (v6+)**
```typescript
import { useNavigate } from 'react-router-dom';
import { createReactRouterDriver } from 'guardap/drivers/react-router';

// Inside your component/hook
const navigate = useNavigate();

const AccessGuard = createGuard({
  // ... config
  router: {
    driver: createReactRouterDriver(navigate),
  },
});
```

**TanStack Router**
```typescript
import { TanStackDriver } from 'guardap/drivers/tanstack';

const AccessGuard = createGuard({
  // ... config
  router: {
    driver: TanStackDriver,
  },
});
```

**Other Routers (Next.js / Custom)**
You can easily create a custom driver for any router.

```typescript
const AccessGuard = createGuard({
  // ... config
  router: {
    driver: (url) => {
      // Your custom redirect logic
      window.location.href = url; 
    },
  },
});
```

## Contribution

We welcome contributions! Please follow these steps:

1.  **Fork** the repository.
2.  **Clone** your fork: `git clone https://github.com/your-username/guardap.git`
3.  **Install dependencies**: `pnpm install`
4.  **Create a branch**: `git checkout -b feature/my-new-feature`
5.  **Make changes** and run tests: `npm test`
6.  **Commit** your changes: `git commit -m 'Add some feature'`
7.  **Push** to the branch: `git push origin feature/my-new-feature`
8.  **Submit a Pull Request**.

Please ensure your code follows the existing style and includes tests for new features.

