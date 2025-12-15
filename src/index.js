// worker.js
// 必须通过 env.SIGNAL_KV 访问 KV，且 fetch 必须接收 env 参数！

export default {
  // 注意：第二个参数是 env，必须保留！
  async fetch(request, env) {
    const url = new URL(request.url);

    // 路由：/signal
    if (url.pathname === '/signal') {
      if (request.method === 'POST') {
        try {
          const { code, offer, answer, candidate } = await request.json();
          if (!code || code.length !== 5) {
            return new Response('Invalid code', { status: 400 });
          }

          // 从 KV 读取当前会话
          let session = await env.SIGNAL_KV.get(code, { type: 'json' }) || {};

          if (offer !== undefined) session.offer = offer;
          if (answer !== undefined) session.answer = answer;
          if (candidate !== undefined) {
            session.candidates = session.candidates || [];
            session.candidates.push(candidate);
          }

          // 写回 KV，10分钟过期
          await env.SIGNAL_KV.put(code, JSON.stringify(session), { expirationTtl: 600 });
          return new Response(null, { status: 204 });
        } catch (e) {
          return new Response('Bad Request', { status: 400 });
        }
      }

      if (request.method === 'GET') {
        const code = url.searchParams.get('code');
        if (!code) return new Response('Missing code', { status: 400 });
        const session = await env.SIGNAL_KV.get(code, { type: 'json' }) || {};
        return Response.json({ offer: session.offer || null });
      }
    }

    // 路由：/candidates
    if (url.pathname === '/candidates') {
      const code = url.searchParams.get('code');
      if (!code) return new Response('Missing code', { status: 400 });
      const session = await env.SIGNAL_KV.get(code, { type: 'json' }) || {};
      const cands = session.candidates || [];
      // 清空已读候选（可选）
      if (cands.length > 0) {
        session.candidates = [];
        await env.SIGNAL_KV.put(code, JSON.stringify(session), { expirationTtl: 600 });
      }
      return Response.json(cands);
    }

    // 根路径：返回说明
    return new Response(`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>WebRTC Signal Ready</title></head>
<body style="font-family:system-ui; padding:2rem; max-width:600px;">
  <h2>✅ WebRTC 信令服务已启动</h2>
  <p>请确保：</p>
  <ul>
    <li>KV 命名空间已绑定为 <code>SIGNAL_KV</code></li>
    <li>前端 SIGNALING_URL 指向此域名</li>
  </ul>
  <p>Worker URL: <code>${url.origin}</code></p>
</body>
</html>`, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
};
