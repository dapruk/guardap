import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';

import type { GuardConfig, IGuardChain } from '../core/types';
import { createGuard as createCoreGuard } from '../index';

export interface AccessGuardProps<
  TRole extends string,
  TFeature extends string,
  TAction extends string,
  TCondition extends string,
  TGroup extends string,
> {
  children?: ReactNode;
  fallback?: ReactNode;
  loadingComponent?: ReactNode;
  suspense?: boolean;

  login?: boolean;
  guest?: boolean;

  role?: TRole | TRole[] | readonly TRole[];

  group?: TGroup | TGroup[] | readonly TGroup[];

  condition?: TCondition;

  feature?: TFeature;
  action?: TAction;
}

// Simple cache for Suspense promises
const suspenseCache = new Map<
  string,
  { promise: Promise<boolean>; result?: boolean; error?: any }
>();

/**
 * Creates a configured Guard instance bound to React components.
 * This is the recommended way to use Guardap in React applications.
 */
export function createGuard<
  TRole extends string,
  TFeature extends string,
  TAction extends string,
  TCondition extends string = string,
  TGroup extends string = string,
  TData = any,
  TContext = any,
>(
  config: GuardConfig<
    TRole,
    TFeature,
    TAction,
    TCondition,
    TGroup,
    TData,
    TContext
  >,
) {
  const guardInstance = createCoreGuard(config);
  const GuardContext = createContext(guardInstance);

  const GuardProvider = ({ children }: { children: ReactNode }) => {
    return (
      <GuardContext.Provider value={guardInstance}>
        {children}
      </GuardContext.Provider>
    );
  };

  const useGuard = () => {
    const context = useContext(GuardContext);
    if (!context) {
      throw new Error('useGuard must be used within GuardProvider');
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

    const api = useGuard();
    const [isAllowed, setIsAllowed] = useState<boolean | null>(null);

    if (suspense) {
      const key = JSON.stringify({
        login,
        guest,
        role,
        group,
        condition,
        feature,
        action,
      });

      let cached = suspenseCache.get(key);

      if (cached?.result !== undefined) {
        return cached.result ? <>{children}</> : <>{fallback}</>;
      }

      if (cached?.promise) {
        throw cached.promise;
      }

      const check = () => {
        let builder: IGuardChain<
          TRole,
          TFeature,
          TAction,
          TCondition,
          TGroup,
          TData
        > = api.with(undefined as any);
        if (login) builder = builder.requireLogin();
        if (guest) builder = builder.guestOnly();

        if (group) {
          if (Array.isArray(group)) {
            builder = builder.requireGroup(group);
          } else {
            builder = builder.requireGroup(group as TGroup);
          }
        }

        if (role) {
          if (Array.isArray(role)) {
            builder = builder.requireRole(role);
          } else {
            builder = builder.requireRole(role as TRole);
          }
        }
        if (condition) builder = builder.mustBe(condition);
        if (feature && action) builder = builder.require(action).on(feature);
        return builder;
      };

      try {
        const result = check().allowed();
        return result ? <>{children}</> : <>{fallback}</>;
      } catch (e) {
        const promise = check()
          .allowedAsync()
          .then((result: boolean) => {
            suspenseCache.set(key, { promise, result });
            return result;
          });
        suspenseCache.set(key, { promise });
        throw promise;
      }
    }

    useEffect(() => {
      let builder: IGuardChain<
        TRole,
        TFeature,
        TAction,
        TCondition,
        TGroup,
        TData
      > = api.with(undefined as any);

      if (login) builder = builder.requireLogin();
      if (guest) builder = builder.guestOnly();

      if (group) {
        if (Array.isArray(group)) {
          builder = builder.requireGroup(group);
        } else {
          builder = builder.requireGroup(group as TGroup);
        }
      }

      if (role) {
        if (Array.isArray(role)) {
          builder = builder.requireRole(role);
        } else {
          builder = builder.requireRole(role as TRole);
        }
      }
      if (condition) builder = builder.mustBe(condition);
      if (feature && action) builder = builder.require(action).on(feature);

      try {
        const result = builder.allowed();
        setIsAllowed(result);
      } catch (e) {
        builder.allowedAsync().then((result: boolean) => {
          setIsAllowed(result);
        });
      }
    }, [api, login, guest, group, role, condition, feature, action]);

    if (isAllowed === null) return <>{loadingComponent || fallback}</>;

    return isAllowed ? <>{children}</> : <>{fallback}</>;
  };

  function withAuth<P extends object>(
    Component: ComponentType<P>,
    options: Omit<
      AccessGuardProps<TRole, TFeature, TAction, TCondition, TGroup>,
      'children'
    >,
  ) {
    return function WithAuthWrapper(props: P) {
      return (
        <AccessGuard {...options}>
          <Component {...props} />
        </AccessGuard>
      );
    };
  }

  return {
    ...guardInstance,
    GuardProvider,
    useGuard,
    AccessGuard,
    withAuth,
  };
}
