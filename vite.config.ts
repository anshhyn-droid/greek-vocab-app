import react from '@vitejs/plugin-react';
import type { IncomingMessage } from 'node:http';
import { defineConfig, loadEnv, type Plugin } from 'vite';

// 개발 서버에서 /api/* 를 server/router.ts로 처리 (배포에서는 Vercel 함수 api/index.ts가 같은 코드를 씀)
function api(): Plugin {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        try {
          const { route } = await server.ssrLoadModule('/server/router.ts');
          const chunks: Buffer[] = [];
          for await (const c of req as IncomingMessage) chunks.push(c as Buffer);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (v != null) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
          const host = req.headers.host || 'localhost';
          const request = new Request(`http://${host}${req.url}`, {
            method: req.method,
            headers,
            body: req.method === 'GET' || req.method === 'HEAD' || !chunks.length ? undefined : Buffer.concat(chunks),
          });
          const out: Response = await route(request);
          res.statusCode = out.status;
          out.headers.forEach((v, k) => { if (k !== 'set-cookie') res.setHeader(k, v); });
          const cookies = out.headers.getSetCookie();
          if (cookies.length) res.setHeader('set-cookie', cookies);
          res.end(Buffer.from(await out.arrayBuffer()));
        } catch (e) {
          server.ssrFixStacktrace(e as Error);
          console.error(e);
          res.statusCode = 500;
          res.end('{"error":"server_error"}');
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // 서버 코드가 쓰는 비밀값(.env의 GOOGLE_*, TURSO_* 등)을 process.env로
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return {
    plugins: [react(), api()],
    // Google OAuth 리디렉션 주소(http://localhost:3000/api/auth/callback/google)와 맞춤
    server: { port: 3000, strictPort: true },
  };
});
