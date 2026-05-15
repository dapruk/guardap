export type GuardapRoutePath<TPath> = TPath extends string ? TPath : string;

export type GuardapConfigContext<TPathOrContext, TContext> =
  unknown extends TContext
    ? TPathOrContext extends string
      ? any
      : TPathOrContext
    : TContext;

export type RouterDriver<TRoutePath extends string = string> = (
  url: TRoutePath,
) => void;

export type PermissionValue = string | string[];

export type PermissionMatrix<TFeature extends string> = Partial<
  Record<TFeature | '*', PermissionValue>
>;

export interface IGuardChain<
  TRole extends string,
  TFeature extends string,
  TAction extends string,
  TCondition extends string,
  TGroup extends string,
  TData = any,
  TRoutePath extends string = string,
> {
  // Method Overloading for strict typing
  requireRole(role: TRole): this;
  requireRole(roles: TRole[] | readonly TRole[]): this;

  requireGroup(group: TGroup): this;
  requireGroup(groups: TGroup[] | readonly TGroup[]): this;

  requireLogin(): this;
  guestOnly(): this;
  mustBe(condition: TCondition): this;

  require(action: TAction): {
    on: (
      feature: TFeature,
    ) => IGuardChain<
      TRole,
      TFeature,
      TAction,
      TCondition,
      TGroup,
      TData,
      TRoutePath
    >;
  };

  or(): this;

  redirect(to?: TRoutePath): void;

  allowed(): boolean;
  allowedAsync(): Promise<boolean>;
}

export interface GuardapRouteMeta<
  TRole extends string = string,
  TFeature extends string = string,
  TAction extends string = string,
  TCondition extends string = string,
  TGroup extends string = string,
  TRoutePath extends string = string,
> {
  login?: boolean;
  guest?: boolean;
  role?: TRole | readonly TRole[];
  group?: TGroup | readonly TGroup[];
  condition?: TCondition;
  feature?: TFeature;
  action?: TAction;
  redirectTo?: TRoutePath;
}

export interface GuardapGuardLike<
  TRole extends string,
  TFeature extends string,
  TAction extends string,
  TCondition extends string,
  TGroup extends string,
  TData = any,
  TRoutePath extends string = string,
  TContext = any,
> {
  with(
    context: TContext,
  ): IGuardChain<
    TRole,
    TFeature,
    TAction,
    TCondition,
    TGroup,
    TData,
    TRoutePath
  >;
}

export type UserState<
  TRole extends string,
  TCondition extends string,
  TData = any,
> = {
  roles: TRole[];
  conditions: Partial<Record<TCondition, boolean>>;
  isAuthenticated?: boolean;
} & TData;

export interface GuardConfig<
  TRole extends string,
  TFeature extends string,
  TAction extends string,
  TCondition extends string,
  TGroup extends string,
  TData = any,
  TRoutePathOrContext = string,
  TContext = unknown,
> {
  resolveAction?: (action: TAction) => string;
  getPermissions: (roles: TRole[]) => PermissionMatrix<TFeature>;
  getUserState: (
    ctx?: GuardapConfigContext<TRoutePathOrContext, TContext>,
  ) =>
    | UserState<TRole, TCondition, TData>
    | Promise<UserState<TRole, TCondition, TData>>;
  router?: { driver?: RouterDriver<GuardapRoutePath<TRoutePathOrContext>> };
  redirects?: Partial<
    Record<
      GuardapRoutePath<TRoutePathOrContext>,
      GuardapRoutePath<TRoutePathOrContext>
    >
  >;
  defaultRedirect?: GuardapRoutePath<TRoutePathOrContext>;
  groups?: Record<TGroup, TRole[]>;
  debug?: boolean;
}

export interface GuardContext<
  TRole,
  TFeature extends string,
  TCondition extends string,
  TData = any,
> {
  roles: TRole[];
  permissions: PermissionMatrix<TFeature>;
  conditions: Partial<Record<TCondition, boolean>>;
  isAuthenticated: boolean;
  data: TData;
}
