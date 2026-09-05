// The SpacetimeDB token in localStorage is the whole session: same token, same
// identity, same Echoe. Forgetting it and reloading gives this browser a fresh
// identity, so "log out" is exactly that. The old Echoe stays in the room as a
// home Echoe under the old name; nothing is deleted.

export const HOST = import.meta.env.VITE_SPACETIMEDB_HOST ?? 'ws://localhost:3000';
export const DB_NAME = import.meta.env.VITE_SPACETIMEDB_DB_NAME ?? 'react-ts';
export const TOKEN_KEY = `${HOST}/${DB_NAME}/auth_token`;

export function logout(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // no storage means no session was ever kept
  }
  location.assign('/');
}
