import type { NavigateFunction } from 'react-router-dom';
import type { RouterDriver } from '../core/types';

export const createReactRouterDriver = (
  navigate: NavigateFunction,
): RouterDriver => {
  return (url) => {
    navigate(url);
  };
};
