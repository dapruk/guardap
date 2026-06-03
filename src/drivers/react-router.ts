import { applyGuardMeta, evaluateGuardMeta } from '../core/meta';
import type { GuardapRouteMeta, RouterDriver } from '../core/types';

type StripLeadingSlash<TPath extends string> = string extends TPath
  ? string
  : TPath extends `/${infer TRest}`
    ? StripLeadingSlash<TRest>
    : TPath;

type StripTrailingSlash<TPath extends string> = string extends TPath
  ? string
  : TPath extends '/'
    ? TPath
    : TPath extends `${infer TRest}/`
      ? StripTrailingSlash<TRest>
      : TPath;

type NormalizePath<TPath extends string> = string extends TPath
  ? string
  : TPath extends ''
    ? '/'
    : TPath extends `/${string}`
      ? StripTrailingSlash<TPath>
      : StripTrailingSlash<`/${TPath}`>;

type JoinRoutePath<
  TParent extends string,
  TPath extends string,
> = string extends TPath
  ? string
  : TPath extends `/${string}`
    ? NormalizePath<TPath>
    : TPath extends ''
      ? NormalizePath<TParent>
      : TParent extends '' | '/'
        ? NormalizePath<`/${StripLeadingSlash<TPath>}`>
        : NormalizePath<`${NormalizePath<TParent>}/${StripLeadingSlash<TPath>}`>;

export interface ReactRouterRouteObject {
  path?: string;
  index?: boolean;
  children?: readonly unknown[];
}

export type ReactRouterRoutePaths<
  TRoutes,
  TParent extends string = '',
> = TRoutes extends readonly unknown[]
  ? ReactRouterRoutePaths<TRoutes[number], TParent>
  : TRoutes extends { index: true }
    ? NormalizePath<TParent>
    : TRoutes extends { path: infer TPath extends string }
      ?
          | JoinRoutePath<TParent, TPath>
          | (TRoutes extends { children: infer TChildren }
              ? ReactRouterRoutePaths<TChildren, JoinRoutePath<TParent, TPath>>
              : never)
      : TRoutes extends { children: infer TChildren }
        ? ReactRouterRoutePaths<TChildren, TParent>
        : never;

export type ReactRouterNavigateFunction<TRoutePath extends string = string> = (
  to: TRoutePath,
  ...args: any[]
) => unknown;

export type DefinedReactRouterRoutes<TRoutePath extends string = string> =
  readonly unknown[] & {
    readonly __guardapRoutePath?: TRoutePath;
  };

type InferDefinedReactRouterRoutePaths<TRoutes> = TRoutes extends {
  readonly __guardapRoutePath?: infer TRoutePath extends string;
}
  ? TRoutePath
  : string;

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

export const defineReactRouterRoutes = <
  const TRoutes extends readonly unknown[],
>(
  routes: TRoutes,
) =>
  routes as TRoutes & DefinedReactRouterRoutes<ReactRouterRoutePaths<TRoutes>>;

export function createReactRouterDriver<
  const TRoutes extends DefinedReactRouterRoutes,
>(
  navigate: ReactRouterNavigateFunction,
  routes: TRoutes,
): RouterDriver<InferDefinedReactRouterRoutePaths<TRoutes>>;
export function createReactRouterDriver<TRoutePath extends string = string>(
  navigate: ReactRouterNavigateFunction<TRoutePath>,
): RouterDriver<TRoutePath>;
export function createReactRouterDriver(
  navigate: ReactRouterNavigateFunction,
): RouterDriver {
  return (url) => {
    navigate(url);
  };
}
