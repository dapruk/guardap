import { redirect } from '@tanstack/react-router';
import type { RouterDriver } from '../core/types';

export const TanStackDriver: RouterDriver = (url) => {
  throw redirect({
    to: url as any,
  });
};
