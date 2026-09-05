// OpenRouter PKCE, browser half. The server does the code exchange
// (linkOpenRouter), so no key ever exists in this bundle.
// Source: openrouter.ai docs, guides/overview/auth/oauth (read 2026-09-05).

const VERIFIER_KEY = 'echoe.openrouter.verifier';

const base64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Sends the tab to OpenRouter. It comes back to this same path with ?code=. */
export async function startOpenRouterLink(): Promise<void> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  try {
    sessionStorage.setItem(VERIFIER_KEY, verifier);
  } catch {
    return; // no storage, no way to finish the flow; the button simply does nothing
  }
  const callback = `${location.origin}${location.pathname}`;
  const url = new URL('https://openrouter.ai/auth');
  url.searchParams.set('callback_url', callback);
  url.searchParams.set('code_challenge', base64url(new Uint8Array(digest)));
  url.searchParams.set('code_challenge_method', 'S256');
  location.assign(url.toString());
}

/** On return from OpenRouter: the code and verifier, once, with the URL cleaned. */
export function takeOpenRouterCode(): { code: string; codeVerifier: string } | null {
  const code = new URLSearchParams(location.search).get('code');
  if (!code) return null;
  let codeVerifier: string | null = null;
  try {
    codeVerifier = sessionStorage.getItem(VERIFIER_KEY);
    sessionStorage.removeItem(VERIFIER_KEY);
  } catch {
    codeVerifier = null;
  }
  history.replaceState(null, '', location.pathname);
  return codeVerifier ? { code, codeVerifier } : null;
}
