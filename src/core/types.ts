export type RouterDriver = (url: string) => void;

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
    ) => IGuardChain<TRole, TFeature, TAction, TCondition, TGroup, TData>;
  };

  or(): this;

  redirect(to?: string): void;

  allowed(): boolean;
  allowedAsync(): Promise<boolean>;
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
  TContext = any,
> {
  resolveAction?: (action: TAction) => string;
  getPermissions: (roles: TRole[]) => PermissionMatrix<TFeature>;
  getUserState: (
    ctx?: TContext,
  ) =>
    | UserState<TRole, TCondition, TData>
    | Promise<UserState<TRole, TCondition, TData>>;
  router?: { driver?: RouterDriver };
  redirects?: Record<string, string>;
  defaultRedirect?: string;
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
