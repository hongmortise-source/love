// ============================================================
// ♥ 头像云函数（部署到 EdgeOne Pages 后自动生效）
//   GET  /api/avatar?who=liu|hong → 返回头像图片（data URL）
//   POST /api/avatar {who, data}  → 保存头像，并更新头像版本号让对方刷新
// 使用前需在 EdgeOne 控制台绑定 KV，变量名必须填 LOVE_KV
// ============================================================

const PASSCODE = '';   // 可选口令：和 config.js 里的 SYNC_PASSCODE 填一致才启用

const KEY_AVATAR = { liu: 'avatar_liu', hong: 'avatar_hong' };
const REV_FIELD = { liu: 'avatarLiuRev', hong: 'avatarHongRev' };

function getKv(env) {
  return typeof LOVE_KV !== 'undefined' ? LOVE_KV : (env && env.LOVE_KV);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  });
}

async function readState(store) {
  const raw = await store.get('couple');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function checkPasscode(request) {
  return !PASSCODE || request.headers.get('x-love-code') === PASSCODE;
}

export async function onRequestGet({ request, env }) {
  const store = getKv(env);
  if (!store) return json({ ok: false, error: 'KV 未绑定（变量名需为 LOVE_KV）' }, 500);
  if (!checkPasscode(request)) return json({ ok: false, error: '口令不对' }, 401);
  try {
    const url = new URL(request.url);
    const who = url.searchParams.get('who') === 'hong' ? 'hong' : 'liu';
    const data = await store.get(KEY_AVATAR[who]);
    return json({ ok: true, data: data || null });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const store = getKv(env);
  if (!store) return json({ ok: false, error: 'KV 未绑定（变量名需为 LOVE_KV）' }, 500);
  if (!checkPasscode(request)) return json({ ok: false, error: '口令不对' }, 401);
  try {
    const body = await request.json();
    const who = body.who === 'hong' ? 'hong' : 'liu';
    const data = String(body.data || '');
    if (!data.startsWith('data:image/') || data.length > 400000) {
      return json({ ok: false, error: '图片太大或格式不对' }, 400);
    }
    const rev = Date.now();
    await store.put(KEY_AVATAR[who], data);
    const state = await readState(store);
    state[REV_FIELD[who]] = rev;
    await store.put('couple', JSON.stringify(state));
    return json({ ok: true, rev });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type, x-love-code',
    },
  });
}
