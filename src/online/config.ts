export interface OnlineConfig {
  url: string;
  publishableKey: string;
}

type Env = Record<string, string | undefined>;

/** service_role の JWT かどうか（ペイロードの role を見る） */
function isServiceRoleJwt(key: string): boolean {
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const json = atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'));
    return (JSON.parse(json) as { role?: string }).role === 'service_role';
  } catch {
    return false;
  }
}

function isAllowedUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    return url.protocol === 'https:' || (url.protocol === 'http:' && isLocal);
  } catch {
    return false;
  }
}

/**
 * 環境変数から、Supabase の接続設定を読む。使えない設定は null（オンライン対戦は無効になる）。
 * 秘密鍵（service_role / secret key）がクライアントに渡ってしまう設定ミスは、ここで弾く。
 */
export function readOnlineConfig(env: Env = import.meta.env): OnlineConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '');
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) return null;
  if (!isAllowedUrl(url)) return null;
  if (publishableKey.startsWith('sb_secret_') || isServiceRoleJwt(publishableKey)) return null;
  return { url, publishableKey };
}

export function isOnlineConfigured(env: Env = import.meta.env): boolean {
  return readOnlineConfig(env) !== null;
}
