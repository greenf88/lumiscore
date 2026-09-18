import { getSafeNextPath } from './request.ts';

export type HeaderAuthState = {
  authenticated: boolean;
  displayName?: string | null;
  avatarLetter?: string | null;
};

export type HeaderAuthPresentation = HeaderAuthState & {
  displayName: string | null;
  avatarLetter: string;
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
    displayName: authState.displayName?.trim() || null,
    avatarLetter: authState.avatarLetter?.trim() || '?',
    returnTo,
    signInHref: `/login?next=${encodeURIComponent(returnTo)}`,
  };
}
