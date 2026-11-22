import { useCallback, useEffect, useRef, useState } from 'react';

/** 一時的に表示する通知。表示するたびに、消えるまでの時間を数え直す */
export function useToast(durationMs = 2000) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback(
    (text: string) => {
      clearTimeout(timer.current);
      setMessage(text);
      timer.current = setTimeout(() => setMessage(null), durationMs);
    },
    [durationMs],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  return { message, show };
}
