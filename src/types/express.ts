import type { AuthContext, AuthenticatedUser } from './auth';
import type { SubscriptionAccess } from './subscription';

declare global {
  namespace Express {
    interface Request {
      auth: AuthContext;
      currentUser: AuthenticatedUser | null;
      subscriptionAccess?: SubscriptionAccess;
    }
  }
}

export {};
