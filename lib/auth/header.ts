import { getSafeNextPath } from './request.ts';

export type HeaderAuthState = {
  authenticated: boolean;
};

export type HeaderAuthPresentation = HeaderAuthState & {
  returnTo: string;
  signInHref: string;
};

export function getHeaderAuthPresentation(
  authState: HeaderAuthState,
  requestedReturnTo: string,
): HeaderAuthPresentation {
  const returnTo = getSafeNextPath(requestedReturnTo);
  return {
    authenticated: authState.authenticated,
    returnTo,
    signInHref: `/login?next=${encodeURIComponent(returnTo)}`,
  };
}
