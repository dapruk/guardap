import { GuardConfig, GuardContext, IGuardChain } from './types';

export class GuardBuilder<
  TRole extends string,
  TFeature extends string,
  TAction extends string,
  TCondition extends string,
  TGroup extends string,
> implements IGuardChain<TRole, TFeature, TAction, TCondition, TGroup> {
  private config: GuardConfig<TRole, TFeature, TAction, TCondition, TGroup>;
  private context: GuardContext<TRole, TFeature, TCondition> | null = null;
  private promise: Promise<GuardContext<TRole, TFeature, TCondition>> | null =
    null;

  private isAllowed: boolean = true;
  private wasPreviouslyAllowed: boolean = false;

  private asyncOps: ((
    builder: GuardBuilder<TRole, TFeature, TAction, TCondition, TGroup>,
  ) => void)[] = [];

  constructor(
    config: GuardConfig<TRole, TFeature, TAction, TCondition, TGroup>,
    contextOrPromise:
      | GuardContext<TRole, TFeature, TCondition>
      | Promise<GuardContext<TRole, TFeature, TCondition>>,
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
      builder: GuardBuilder<TRole, TFeature, TAction, TCondition, TGroup>,
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

  requireRole(role: TRole | TRole[]): this {
    if (this.promise) return this.enqueue((b) => b.requireRole(role));
    if (this.shouldSkipCheck()) return this;

    const requiredRoles = Array.isArray(role) ? role : [role];
    const hasRole = this.context!.roles.some((asked) =>
      requiredRoles.includes(asked),
    );
    if (!hasRole) this.isAllowed = false;
    return this;
  }

  requireGroup(group: TGroup | TGroup[]): this {
    if (this.promise) return this.enqueue((b) => b.requireGroup(group));
    if (this.shouldSkipCheck()) return this;

    const groupConfig = this.config.groups;
    if (!groupConfig) {
      this.isAllowed = false;
      return this;
    }

    const groupsToCheck = Array.isArray(group) ? group : [group];
    const allowedRoles = new Set<string>();

    for (const g of groupsToCheck) {
      const roles = groupConfig[g];
      if (roles) roles.forEach((askedRoles) => allowedRoles.add(askedRoles));
    }

    const hasRole = this.context!.roles.some((askedRoles) =>
      allowedRoles.has(askedRoles),
    );
    if (!hasRole) this.isAllowed = false;
    return this;
  }

  requireLogin(): this {
    if (this.promise) return this.enqueue((b) => b.requireLogin());
    if (this.shouldSkipCheck()) return this;
    if (!this.context!.isAuthenticated) this.isAllowed = false;
    return this;
  }

  guestOnly(): this {
    if (this.promise) return this.enqueue((b) => b.guestOnly());
    if (this.shouldSkipCheck()) return this;
    if (this.context!.isAuthenticated) this.isAllowed = false;
    return this;
  }

  mustBe(conditions: TCondition): this {
    if (this.promise) return this.enqueue((b) => b.mustBe(conditions));
    if (this.shouldSkipCheck()) return this;
    if (this.context!.conditions[conditions] !== true) this.isAllowed = false;
    return this;
  }

  require(action: TAction) {
    return {
      on: (feature: TFeature): this => {
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
          return this;
        }

        const resolver = this.config.resolveAction;
        if (!resolver) {
          this.isAllowed = false;
          return this;
        }

        const reqCode = resolver(action);

        const hasPerm =
          userPermissions.includes(reqCode) || userPermissions.includes(action);

        if (!hasPerm) {
          this.isAllowed = false;
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

    // Create a new synchronous builder with the resolved context
    const syncBuilder = new GuardBuilder(this.config, resolvedContext);

    // Replay all queued operations
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
