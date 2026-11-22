import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

const read = () => (typeof matchMedia === 'function' ? matchMedia(QUERY).matches : false);

/** OS の「視覚効果を減らす」設定が有効か。設定の変更にも追従する */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(read);

  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mql = matchMedia(QUERY);
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
