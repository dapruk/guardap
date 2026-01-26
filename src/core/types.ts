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
> {
  requireRole(role: TRole | TRole[]): this;
  requireGroup(group: TGroup | TGroup[]): this;
  requireLogin(): this;
  guestOnly(): this;
  mustBe(condition: TCondition): this;

  require(action: TAction): {
    on: (
      feature: TFeature,
    ) => IGuardChain<TRole, TFeature, TAction, TCondition, TGroup>;
  };

  or(): this;

  redirect(to?: string): void;

  allowed(): boolean;
  allowedAsync(): Promise<boolean>;
}

export type UserState<TRole extends string, TCondition extends string> = {
  roles: TRole[];
  conditions: Partial<Record<TCondition, boolean>>;
  isAuthenticated?: boolean;
};

export interface GuardConfig<
  TRole extends string,
  TFeature extends string,
  TAction extends string,
  TCondition extends string,
  TGroup extends string,
  TContext = any,
> {
  resolveAction?: (action: TAction) => string;
  getPermissions: (roles: TRole[]) => PermissionMatrix<TFeature>;
  getUserState: (
    ctx?: TContext,
  ) => UserState<TRole, TCondition> | Promise<UserState<TRole, TCondition>>;
  router?: { driver?: RouterDriver };
  redirects?: Record<string, string>;
  defaultRedirect?: string;
  groups?: Record<TGroup, TRole[]>;
}

export interface GuardContext<
  TRole,
  TFeature extends string,
  TCondition extends string,
> {
  roles: TRole[];
  permissions: PermissionMatrix<TFeature>;
  conditions: Partial<Record<TCondition, boolean>>;
  isAuthenticated: boolean;
}
