import { redirect } from '@tanstack/react-router';
import { applyGuardMeta, evaluateGuardMeta } from '../core/meta';
import type { GuardapRouteMeta } from '../core/types';

export interface TanStackGuardStaticData<
  TRole extends string = string,
  TFeature extends string = string,
  TAction extends string = string,
  TCondition extends string = string,
  TGroup extends string = string,
  TRoutePath extends string = string,
> {
  guard?: GuardapRouteMeta<
    TRole,
    TFeature,
    TAction,
    TCondition,
    TGroup,
    TRoutePath
  >;
}

export const applyTanStackGuardMeta = applyGuardMeta;
export const evaluateTanStackGuard = evaluateGuardMeta;

export type TanStackRoutePath<TRoutePath extends string = string> = TRoutePath;

export const defineTanStackRouterPaths = <
  const TRoutePath extends readonly string[],
>(
  paths: TRoutePath,
) => paths;

export function TanStackDriver<TRoutePath extends string = string>(
  url: TRoutePath,
): void {
  throw redirect({
    to: url as any,
  });
}
