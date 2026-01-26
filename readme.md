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
  Guard.requireRole('admin')
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
const Guard = createGuard<Roles, Features, Actions, Conditions, Groups>({
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
});
```

### Core Logic

The `Guard` instance provides a fluent builder for checking permissions.

**Synchronous Checks (Client)**
```typescript
// Uses default/global state
const isAllowed = Guard.requireRole('admin')
  .require('create').on('posts')
  .allowed();
```

**Asynchronous Checks (Server)**
```typescript
// Injects request context
const isAllowed = await Guard.with(context)
  .requireRole('admin')
  .allowedAsync();
```

**Complex Logic (.or)**
```typescript
Guard.requireRole('admin')    // Check A
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
const isAllowed = Guard.requireRole('admin').allowed();
```

**2. Server-Side (Explicit Context)**
In SSR or Middleware (Node/Next.js), state is request-scoped. Use `.with(context)` to inject the specific request context.

```typescript
// Config: getUserState(ctx) uses the passed context
const isAllowed = await Guard.with(req).requireRole('admin').allowedAsync();
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
Guard.requireRole('admin')    // Branch 1
  .or()                       // OR
  .requireRole('editor')      // Branch 2 (Start)
  .mustBe('isVerified')       // Branch 2 (Continue - AND)
  .allowed();
```

### React Integration

Guardap provides a powerful React adapter with full TypeScript support.

**1. Create the Component**
```typescript
// src/guard.ts
import { createReactAccessGuard } from 'guardap/react';
export const { AccessGuardProvider, AccessGuard, useAccessGuard } = createReactAccessGuard(Guard);
```

**2. Wrap your App**
```tsx
// src/App.tsx
<AccessGuardProvider>
  <AppContent />
</AccessGuardProvider>
```

**3. Protect Components**
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

**4. Suspense Support (Experimental)**
Enable `suspense={true}` to let a parent `<Suspense>` boundary handle the loading state.

```tsx
<Suspense fallback={<GlobalSkeleton />}>
  <AccessGuard role="admin" suspense={true}>
    <AsyncProtectedContent />
  </AccessGuard>
</Suspense>
```

### Router Drivers

Guardap is router-agnostic. You can plug in any router (React Router, TanStack Router, Next.js) via a simple driver.

```typescript
// src/drivers/react-router.ts
import { useNavigate } from 'react-router-dom';

// In your component or hook where you create the Guard (if using hooks)
// Or pass a static driver if using a global router instance
const navigate = useNavigate();

const Guard = createGuard({
  // ... config
  router: {
    driver: (url) => navigate(url),
  },
});
```
*Note: For Next.js App Router, you would use `redirect()` from `next/navigation` in Server Components or `useRouter` in Client Components.*
