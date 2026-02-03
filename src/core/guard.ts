import { GuardConfig, GuardContext, IGuardChain } from './types';

export class GuardBuilder<
  TRole extends string,
  TFeature extends string,
  TAction extends string,
  TCondition extends string,
  TGroup extends string,
  TData = any,
> implements IGuardChain<TRole, TFeature, TAction, TCondition, TGroup, TData> {
  private config: GuardConfig<
    TRole,
    TFeature,
    TAction,
    TCondition,
    TGroup,
    TData
  >;
  private context: GuardContext<TRole, TFeature, TCondition, TData> | null =
    null;
  private promise: Promise<
    GuardContext<TRole, TFeature, TCondition, TData>
  > | null = null;

  private isAllowed: boolean = true;
  private wasPreviouslyAllowed: boolean = false;

  private asyncOps: ((
    builder: GuardBuilder<TRole, TFeature, TAction, TCondition, TGroup, TData>,
  ) => void)[] = [];

  constructor(
    config: GuardConfig<TRole, TFeature, TAction, TCondition, TGroup, TData>,
    contextOrPromise:
      | GuardContext<TRole, TFeature, TCondition, TData>
      | Promise<GuardContext<TRole, TFeature, TCondition, TData>>,
  ) {
    this.config = config;
    if (contextOrPromise instanceof Promise) {
      this.promise = contextOrPromise;
    } else {
      this.context = contextOrPromise;
    }
  }

  private shouldSkipCheck(): boolean {
    return this.wasPreviouslyAllowed || !this.isAllowed;
  }

  private enqueue(
    op: (
      builder: GuardBuilder<
        TRole,
        TFeature,
        TAction,
        TCondition,
        TGroup,
        TData
      >,
    ) => void,
  ): this {
    this.asyncOps.push(op);
    return this;
  }

  or(): this {
    if (this.promise) return this.enqueue((b) => b.or());

    if (this.isAllowed) {
      this.wasPreviouslyAllowed = true;
    }

    this.isAllowed = true;

    return this;
  }

  private logRejection(reason: string, details?: any) {
    if (this.config.debug) {
      console.warn(`[Guardap] Rejected: ${reason}`, details || '');
    }
  }

  requireRole(role: TRole | TRole[] | readonly TRole[]): this {
    if (this.promise) return this.enqueue((b) => b.requireRole(role as any)); // cast needed for strict overload compat in callback
    if (this.shouldSkipCheck()) return this;

    const requiredRoles = Array.isArray(role) ? role : [role];
    const hasRole = this.context!.roles.some((asked) =>
      requiredRoles.includes(asked),
    );
    if (!hasRole) {
      this.isAllowed = false;
      this.logRejection(`Missing role`, {
        required: requiredRoles,
        current: this.context!.roles,
      });
    }
    return this;
  }

  requireGroup(group: TGroup | TGroup[] | readonly TGroup[]): this {
    if (this.promise) return this.enqueue((b) => b.requireGroup(group as any));
    if (this.shouldSkipCheck()) return this;

    const groupConfig = this.config.groups;
    if (!groupConfig) {
      this.isAllowed = false;
      this.logRejection('Group config missing');
      return this;
    }

    const groupsToCheck: readonly TGroup[] = Array.isArray(group)
      ? group
      : [group as TGroup];

    const allowedRoles = new Set<string>();

    for (const g of groupsToCheck) {
      const roles = groupConfig[g];
      if (roles) {
        roles.forEach((askedRoles: string) => allowedRoles.add(askedRoles));
      }
    }

    const hasRole = this.context!.roles.some((askedRoles) =>
      allowedRoles.has(askedRoles),
    );
    if (!hasRole) {
      this.isAllowed = false;
      this.logRejection(`Missing group role`, {
        groups: groupsToCheck,
        current: this.context!.roles,
      });
    }
    return this;
  }

  requireLogin(): this {
    if (this.promise) return this.enqueue((b) => b.requireLogin());
    if (this.shouldSkipCheck()) return this;
    if (!this.context!.isAuthenticated) {
      this.isAllowed = false;
      this.logRejection('Unauthenticated');
    }
    return this;
  }

  guestOnly(): this {
    if (this.promise) return this.enqueue((b) => b.guestOnly());
    if (this.shouldSkipCheck()) return this;
    if (this.context!.isAuthenticated) {
      this.isAllowed = false;
      this.logRejection('Authenticated user (Guest only)');
    }
    return this;
  }

  mustBe(conditions: TCondition): this {
    if (this.promise) return this.enqueue((b) => b.mustBe(conditions));
    if (this.shouldSkipCheck()) return this;
    if (this.context!.conditions[conditions] !== true) {
      this.isAllowed = false;
      this.logRejection(`Condition not met: ${conditions}`);
    }
    return this;
  }

  require(action: TAction) {
    return {
      on: (
        feature: TFeature,
      ): IGuardChain<TRole, TFeature, TAction, TCondition, TGroup, TData> => {
        if (this.promise) {
          this.enqueue((b) => {
            b.require(action).on(feature);
          });
          return this;
        }

        if (this.wasPreviouslyAllowed || !this.isAllowed) return this;

        if (this.context!.permissions['*']) return this;

        const userPermissions = this.context!.permissions[feature];

        // Feature-Level Wildcard Check
        if (userPermissions === '*') return this;
        if (Array.isArray(userPermissions) && userPermissions.includes('*'))
          return this;

        if (!userPermissions) {
          this.isAllowed = false;
          this.logRejection(`No permissions for feature: ${feature}`);
          return this;
        }

        const resolver = this.config.resolveAction;
        if (!resolver) {
          this.isAllowed = false;
          this.logRejection('No action resolver configured');
          return this;
        }

        const reqCode = resolver(action);

        const hasPerm =
          userPermissions.includes(reqCode) || userPermissions.includes(action);

        if (!hasPerm) {
          this.isAllowed = false;
          this.logRejection(`Missing permission: ${action} on ${feature}`, {
            required: reqCode,
            current: userPermissions,
          });
        }

        return this;
      },
    };
  }

  allowed(): boolean {
    if (this.promise) {
      throw new Error(
        '[Guardap] Cannot call .allowed() on an async Guard. Use .allowedAsync() instead.',
      );
    }
    return this.wasPreviouslyAllowed || this.isAllowed;
  }

  async allowedAsync(): Promise<boolean> {
    if (!this.promise) return this.allowed();

    const resolvedContext = await this.promise;

    const syncBuilder = new GuardBuilder(this.config, resolvedContext);

    for (const op of this.asyncOps) {
      op(syncBuilder);
    }

    return syncBuilder.allowed();
  }

  redirect(to?: string): void {
    if (this.promise) {
      console.warn(
        '[Guardap] .redirect() is ignored in async mode. Handle redirection manually after await .allowedAsync()',
      );
      return;
    }

    if (this.wasPreviouslyAllowed || this.isAllowed) return;

    if (!this.config.router?.driver) {
      console.warn('[Guardap] No router driver configured.');
      return;
    }

    let targetUrl = to || this.config.defaultRedirect || '/';
    if (this.config.redirects && this.config.redirects[targetUrl]) {
      targetUrl = this.config.redirects[targetUrl];
    }

    this.config.router.driver(targetUrl);
  }
}
