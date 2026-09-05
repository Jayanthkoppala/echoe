import { useEffect, useState } from 'react';

/** True from the first commit onwards, so a CSS entrance class can be toggled. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
