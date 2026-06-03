import type { AnyRouter } from '@tanstack/react-router';
import { redirect } from '@tanstack/react-router';
import { applyGuardMeta, evaluateGuardMeta } from '../core/meta';
import type { GuardapRouteMeta, RouterDriver } from '../core/types';

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

type ParseTanStackRoutes<TRoute> = TRoute extends {
  types: { children: infer TChildren };
}
  ? unknown extends TChildren
    ? TRoute
    : TChildren extends readonly unknown[]
      ? TRoute | ParseTanStackRoutes<TChildren[number]>
      : TRoute | ParseTanStackRoutes<TChildren[keyof TChildren]>
  : TRoute;

type TanStackCodeRoutePaths<TRouteTree> =
  ParseTanStackRoutes<TRouteTree> extends infer TRoute
    ? TRoute extends { fullPath: infer TPath extends string }
      ? TPath
      : TRoute extends { types: { fullPath: infer TPath extends string } }
        ? TPath
        : never
    : never;

export type TanStackRouterRoutePaths<TRouter extends AnyRouter> =
  TRouter['routeTree'] extends {
    types: { fileRouteTypes: { fullPaths: infer TPath extends string } };
  }
    ? TPath | '/'
    : TanStackCodeRoutePaths<TRouter['routeTree']> | '/';

export const defineTanStackRouterPaths = <
  const TRoutePath extends readonly string[],
>(
  paths: TRoutePath,
) => paths;

export function createTanStackRouterDriver<TRouter extends AnyRouter>(
  _router: TRouter,
): RouterDriver<TanStackRouterRoutePaths<TRouter>> {
  return ((url: TanStackRouterRoutePaths<TRouter>) => {
    throw redirect({
      to: url as any,
    });
  }) as RouterDriver<TanStackRouterRoutePaths<TRouter>>;
}

export function TanStackDriver<TRoutePath extends string = string>(
  url: TRoutePath,
): void {
  throw redirect({
    to: url as any,
  });
}
