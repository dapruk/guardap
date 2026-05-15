import type { GuardapGuardLike, GuardapRouteMeta, IGuardChain } from './types';

export const defineGuardRedirects =
  <TRoutePath extends string>() =>
  <TRedirects extends Partial<Record<TRoutePath, TRoutePath>>>(
    redirects: TRedirects &
      Record<Exclude<keyof TRedirects, TRoutePath>, never>,
  ) =>
    redirects;

export function applyGuardMeta<
  TRole extends string,
  TFeature extends string,
  TAction extends string,
  TCondition extends string,
  TGroup extends string,
  TData = any,
  TRoutePath extends string = string,
  TContext = any,
>(
  guard: GuardapGuardLike<
    TRole,
    TFeature,
    TAction,
    TCondition,
    TGroup,
    TData,
    TRoutePath,
    TContext
  >,
  meta: GuardapRouteMeta<
    TRole,
    TFeature,
    TAction,
    TCondition,
    TGroup,
    TRoutePath
  > = {},
  context?: TContext,
): IGuardChain<
  TRole,
  TFeature,
  TAction,
  TCondition,
  TGroup,
  TData,
  TRoutePath
> {
  let chain = guard.with(context as TContext);

  if (meta.login) chain = chain.requireLogin();
  if (meta.guest) chain = chain.guestOnly();

  if (meta.group) {
    chain = Array.isArray(meta.group)
      ? chain.requireGroup(meta.group as readonly TGroup[])
      : chain.requireGroup(meta.group as TGroup);
  }

  if (meta.role) {
    chain = Array.isArray(meta.role)
      ? chain.requireRole(meta.role as readonly TRole[])
      : chain.requireRole(meta.role as TRole);
  }

  if (meta.condition) chain = chain.mustBe(meta.condition);
  if (meta.feature && meta.action)
    chain = chain.require(meta.action).on(meta.feature);

  return chain;
}

export function evaluateGuardMeta<
  TRole extends string,
  TFeature extends string,
  TAction extends string,
  TCondition extends string,
  TGroup extends string,
  TData = any,
  TRoutePath extends string = string,
  TContext = any,
>(
  guard: GuardapGuardLike<
    TRole,
    TFeature,
    TAction,
    TCondition,
    TGroup,
    TData,
    TRoutePath,
    TContext
  >,
  meta: GuardapRouteMeta<
    TRole,
    TFeature,
    TAction,
    TCondition,
    TGroup,
    TRoutePath
  > = {},
  context?: TContext,
): boolean | Promise<boolean> {
  const chain = applyGuardMeta(guard, meta, context);

  try {
    return chain.allowed();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Cannot call .allowed() on an async Guard')
    ) {
      return chain.allowedAsync();
    }

    throw error;
  }
}
