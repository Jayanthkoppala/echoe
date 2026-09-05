// Google Identity Services, loaded once and only when Profile mounts.
// Source: https://developers.google.com/identity/gsi/web/reference/js-reference

const SRC = 'https://accounts.google.com/gsi/client';

export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

interface GsiId {
  initialize(config: { client_id: string; callback: (r: { credential?: string }) => void }): void;
  renderButton(el: HTMLElement, options: Record<string, string>): void;
}

const gsi = (): GsiId | undefined =>
  (window as unknown as { google?: { accounts?: { id?: GsiId } } }).google?.accounts?.id;

let loading: Promise<void> | undefined;

/** Injects the GIS script once per page and resolves when it is usable. */
export function loadGoogle(): Promise<void> {
  if (gsi()) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    const script = existing ?? document.createElement('script');
    script.src = SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('google_script_failed'));
    if (!existing) document.head.appendChild(script);
  });
  return loading;
}

/** Renders Google's own button into `el` and calls back with the ID token. */
export function renderGoogleButton(el: HTMLElement, onToken: (idToken: string) => void): void {
  const id = gsi();
  if (!id || !GOOGLE_CLIENT_ID) return;
  id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: r => {
      if (r.credential) onToken(r.credential);
    },
  });
  id.renderButton(el, { theme: 'filled_black', size: 'large', shape: 'pill' });
}
