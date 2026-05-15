import { GuardBuilder } from './core/guard';
import type {
  GuardapConfigContext,
  GuardapRoutePath,
  GuardConfig,
  UserState,
} from './core/types';
export {
  applyGuardMeta,
  defineGuardRedirects,
  evaluateGuardMeta,
} from './core/meta';

export type {
  GuardapConfigContext,
  GuardapGuardLike,
  GuardapRouteMeta,
  GuardapRoutePath,
  GuardConfig,
  IGuardChain,
  PermissionMatrix,
  PermissionValue,
  RouterDriver,
  UserState,
} from './core/types';

/**
 * Internal helper to resolve standard actions to CRUD codes.
 * Mappings: create/add -> 'c', read/view -> 'r', update/edit -> 'u', delete/remove -> 'd'.
 */
const defaultResolver = (action: string): string => {
  const map: Record<string, string> = {
    create: 'c',
    read: 'r',
    update: 'u',
    delete: 'd',
    view: 'r',
    edit: 'u',
    add: 'c',
    remove: 'd',
  };
  return map[action.toLowerCase()] || action[0].toLowerCase();
};

/**
 * Creates a new Guard instance. This is the main entry point of the library.
 *
 * @example
 * const Auth = createGuard<Roles, Features, Actions>({
 * getUserState: () => ({ roles: ['admin'] }),
 * getPermissions: (roles) => ({ products: 'crud' })
 * });
 *
 * @param config Configuration object defining roles, logic, and state retrieval.
 */
export function createGuard<
  TRole extends string,
  TFeature extends string,
  TAction extends string,
  TCondition extends string = string,
  TGroup extends string = string,
  TData = any,
  TRoutePathOrContext = string,
  TContext = unknown,
>(
  config: GuardConfig<
    TRole,
    TFeature,
    TAction,
    TCondition,
    TGroup,
    TData,
    TRoutePathOrContext,
    TContext
  >,
) {
  const finalResolveAction = config.resolveAction || defaultResolver;
  const finalConfig = { ...config, resolveAction: finalResolveAction };

  type TResolvedContext = GuardapConfigContext<TRoutePathOrContext, TContext>;
  type TResolvedRoutePath = GuardapRoutePath<TRoutePathOrContext>;

  const createBuilder = (ctx?: TResolvedContext) => {
    const userStateOrPromise = finalConfig.getUserState(ctx);

    if (userStateOrPromise instanceof Promise) {
      const contextPromise = userStateOrPromise.then((userState) => {
        const permissions = finalConfig.getPermissions(userState.roles);
        const isAuthenticated =
          userState.isAuthenticated ?? userState.roles.length > 0;

        return {
          roles: userState.roles,
          conditions: userState.conditions,
          permissions,
          isAuthenticated,
          data: userState,
        };
      });

      return new GuardBuilder<
        TRole,
        TFeature,
        TAction,
        TCondition,
        TGroup,
        TData,
        TResolvedRoutePath
      >(finalConfig as any, contextPromise);
    }

    const userState = userStateOrPromise as UserState<TRole, TCondition, TData>;
    const permissions = finalConfig.getPermissions(userState.roles);

    // Auto-detect authentication status:
    // 1. Explicit 'isAuthenticated' flag from user config.
    // 2. Fallback: If roles array is not empty.
    const isAuthenticated =
      userState.isAuthenticated ?? userState.roles.length > 0;

    return new GuardBuilder<
      TRole,
      TFeature,
      TAction,
      TCondition,
      TGroup,
      TData,
      TResolvedRoutePath
    >(finalConfig as any, {
      roles: userState.roles,
      conditions: userState.conditions,
      permissions,
      isAuthenticated,
      data: userState,
    });
  };

  return {
    /**
     * Injects a specific context (e.g., Server Session, Request Object) into the Guard.
     * Useful for Server-Side Rendering (SSR) or Middleware where global state (localStorage) is not available.
     *
     * @param context The context object passed to your `getUserState` config.
     */
    with: (context: TResolvedContext) => createBuilder(context),

    /**
     * Checks if the user possesses one of the specified roles.
     * @param role A single role or an array of roles (OR logic).
     */
    requireRole: (role: TRole | TRole[]) => {
      return createBuilder().requireRole(role);
    },

    /**
     * Checks if the user belongs to one of the specified groups defined in the config.
     * @param group A single group name or an array of group names (OR logic).
     */
    requireGroup: (group: TGroup | TGroup[]) => {
      return createBuilder().requireGroup(group);
    },

    /**
     * Enforces that the user is authenticated.
     * Checks `isAuthenticated` flag or ensures `roles` array is not empty.
     */
    requireLogin: () => {
      return createBuilder().requireLogin();
    },

    /**
     * Enforces that the user is a Guest (NOT authenticated).
     * Inverse of `requireLogin`.
     */
    guestOnly: () => {
      return createBuilder().guestOnly();
    },

    /**
     * Checks if a custom boolean condition (defined in `getUserState`) is met.
     * @param condition The key of the condition to check.
     */
    mustBe: (condition: TCondition) => {
      return createBuilder().mustBe(condition);
    },

    /**
     * Starts a permission check chain.
     * Usage: `.require('action').on('feature')`
     * @param action The action to perform (e.g., 'create', 'read').
     */
    require: (action: TAction) => {
      return createBuilder().require(action);
    },

    /**
     * Triggers the configured Router Driver to redirect IF access was denied.
     * @param to (Optional) The target URL or Alias to redirect to. Defaults to `config.defaultRedirect`.
     */
    redirect: (to?: TResolvedRoutePath) => {
      return createBuilder().redirect(to);
    },

    /**
     * Helper to get a boolean result directly without chaining/redirecting.
     * Useful for Conditional Rendering in UI (Show/Hide buttons).
     *
     * @returns `true` if allowed, `false` otherwise.
     */
    can: (action: TAction, feature: TFeature, context?: TResolvedContext) => {
      return createBuilder(context).require(action).on(feature).allowed();
    },

    /**
     * Accessor to get the computed permission matrix for the current user.
     * Useful for debugging or advanced logic.
     */
    get permissions() {
      const stateOrPromise = finalConfig.getUserState();
      if (stateOrPromise instanceof Promise) {
        throw new Error(
          '[Guardap] Cannot access .permissions synchronously when using async getUserState.',
        );
      }
      return finalConfig.getPermissions(stateOrPromise.roles);
    },
  };
}
