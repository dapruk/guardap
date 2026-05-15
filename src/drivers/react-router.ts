import type { NavigateFunction } from 'react-router-dom';
import { applyGuardMeta, evaluateGuardMeta } from '../core/meta';
import type { GuardapRouteMeta, RouterDriver } from '../core/types';

export interface ReactRouterGuardHandle<
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

export const applyReactRouterGuardMeta = applyGuardMeta;
export const evaluateReactRouterGuard = evaluateGuardMeta;

export const defineReactRouterPaths = <
  const TRoutePath extends readonly string[],
>(
  paths: TRoutePath,
) => paths;

export const createReactRouterDriver = <TRoutePath extends string = string>(
  navigate: NavigateFunction,
): RouterDriver<TRoutePath> => {
  return (url) => {
    navigate(url);
  };
};
