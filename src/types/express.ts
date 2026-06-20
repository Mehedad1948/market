import type { AuthContext, AuthenticatedUser } from './auth';

declare global {
  namespace Express {
    interface Request {
      auth: AuthContext;
      currentUser: AuthenticatedUser | null;
    }
  }
}

export {};
