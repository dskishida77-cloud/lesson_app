/**
 * 公開用ビルドに付ける Content-Security-Policy を作る（要件10.1 / 18.6）。
 * 自分のサイトと、（設定されていれば）自分の Supabase プロジェクト以外への通信と、外部スクリプトを禁止する。
 */
export function buildCsp(supabaseUrl: string | null): string {
  const connect = ["'self'"];
  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl);
      if (url.protocol === 'https:') {
        connect.push(`https://${url.host}`, `wss://${url.host}`);
      } else if (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
        // 開発用（ローカルの Supabase）だけ
        connect.push(`http://${url.host}`, `ws://${url.host}`);
      }
    } catch {
      // 不正な URL では、通信先を増やさない
    }
  }

  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'", // React の style 属性（紙吹雪の位置など）に必要
    "img-src 'self' data: blob:",
    `connect-src ${connect.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}
