import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import type { createGuard } from '@/index';

export interface AccessGuardProps<
  TRole extends string,
  TFeature extends string,
  TAction extends string,
  TCondition extends string,
  TGroup extends string,
> {
  children: ReactNode;
  fallback?: ReactNode;
  loadingComponent?: ReactNode;
  suspense?: boolean;

  login?: boolean;
  guest?: boolean;

  role?: TRole | TRole[];

  group?: TGroup | TGroup[];

  condition?: TCondition;

  feature?: TFeature;
  action?: TAction;
}

// Simple cache for Suspense promises
const suspenseCache = new Map<
  string,
  { promise: Promise<boolean>; result?: boolean; error?: any }
>();

export function createReactAccessGuard<
  TRole extends string,
  TFeature extends string,
  TAction extends string,
  TCondition extends string,
  TGroup extends string,
>(
  guardInstance: ReturnType<
    typeof createGuard<TRole, TFeature, TAction, TCondition, TGroup>
  >,
) {
  const GuardContext = createContext(guardInstance);

  const AccessGuardProvider = ({ children }: { children: ReactNode }) => {
    return (
      <GuardContext.Provider value={guardInstance}>
        {children}
      </GuardContext.Provider>
    );
  };

  const useAccessGuard = () => {
    const context = useContext(GuardContext);
    if (!context) {
      throw new Error('useAccessGuard must be used within AccessGuardProvider');
    }
    return context;
  };

  const AccessGuard = (
    props: AccessGuardProps<TRole, TFeature, TAction, TCondition, TGroup>,
  ) => {
    const {
      children,
      fallback = null,
      loadingComponent = null,
      suspense = false,
      login,
      guest,
      role,
      group,
      condition,
      feature,
      action,
    } = props;

    const api = useAccessGuard();
    const [isAllowed, setIsAllowed] = useState<boolean | null>(null);

    // Suspense Logic
    if (suspense) {
      // Create a unique key for this check
      const key = JSON.stringify({
        login,
        guest,
        role,
        group,
        condition,
        feature,
        action,
        // We might want to include user ID or something if state changes?
        // For now, assuming guard state is stable or we rely on re-render.
        // Actually, if user state changes, we need to invalidate cache?
        // This simple cache might be too simple if user logs out/in without page reload.
        // But for v1.2 it's a start.
      });

      let cached = suspenseCache.get(key);

      if (cached?.result !== undefined) {
        return cached.result ? <>{children}</> : <>{fallback}</>;
      }

      if (cached?.promise) {
        throw cached.promise;
      }

      // Not cached, start check
      let builder = api.with(undefined);
      if (login) builder = builder.requireLogin();
      if (guest) builder = builder.guestOnly();
      if (group) builder = builder.requireGroup(group);
      if (role) builder = builder.requireRole(role);
      if (condition) builder = builder.mustBe(condition);
      if (feature && action) builder = builder.require(action).on(feature);

      try {
        const result = builder.allowed();
        // Synchronous result
        return result ? <>{children}</> : <>{fallback}</>;
      } catch (e) {
        // Async result
        const promise = builder.allowedAsync().then((result) => {
          suspenseCache.set(key, { promise, result });
          return result;
        });
        suspenseCache.set(key, { promise });
        throw promise;
      }
    }

    // Standard Logic (useEffect)
    useEffect(() => {
      let builder = api.with(undefined);

      if (login) builder = builder.requireLogin();
      if (guest) builder = builder.guestOnly();
      if (group) builder = builder.requireGroup(group);
      if (role) builder = builder.requireRole(role);
      if (condition) builder = builder.mustBe(condition);
      if (feature && action) builder = builder.require(action).on(feature);

      try {
        const result = builder.allowed();
        setIsAllowed(result);
      } catch (e) {
        // Async mode
        builder.allowedAsync().then((result) => {
          setIsAllowed(result);
        });
      }
    }, [api, login, guest, group, role, condition, feature, action]);

    if (isAllowed === null) return <>{loadingComponent || fallback}</>;

    return isAllowed ? <>{children}</> : <>{fallback}</>;
  };

  return {
    AccessGuardProvider,
    useAccessGuard,
    AccessGuard,
  };
}
