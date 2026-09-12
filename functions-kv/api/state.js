// ============================================================
// ♥ 共享状态云函数（部署到 EdgeOne Pages 后自动生效）
//   GET  /api/state  → 读取共享数值
//   POST /api/state  → 更新共享数值（inc=加减，set=直接设置）
// 使用前需在 EdgeOne 控制台：开通 KV → 创建命名空间 → 绑定到本项目，
// 绑定时"变量名"必须填 LOVE_KV
// ============================================================

const PASSCODE = '';   // 可选口令：和 config.js 里的 SYNC_PASSCODE 填一致才启用

const KEY_STATE = 'couple';
const INITIAL = {
  intimacy: 0, anger: 0, pervert: 0,
  anniversary: '', avatarLiuRev: 0, avatarHongRev: 0, lastAction: null,
};

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
  const raw = await store.get(KEY_STATE);
  if (!raw) return { ...INITIAL };
  try {
    return { ...INITIAL, ...JSON.parse(raw) };
  } catch (e) {
    return { ...INITIAL };
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
    return json({ ok: true, state: await readState(store) });
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
    const state = await readState(store);

    if (body.inc) {
      ['intimacy', 'anger', 'pervert'].forEach((k) => {
        if (typeof body.inc[k] === 'number') {
          state[k] = Math.max(0, state[k] + Math.round(body.inc[k]));
        }
      });
    }
    if (body.set && typeof body.set.anniversary === 'string') {
      state.anniversary = body.set.anniversary.slice(0, 10);
    }
    if (body.lastAction && typeof body.lastAction.ts === 'number') {
      state.lastAction = {
        type: String(body.lastAction.type || '').slice(0, 16),
        by: body.lastAction.by === 'hong' ? 'hong' : 'liu',
        ts: Math.round(body.lastAction.ts),
      };
    }

    await store.put(KEY_STATE, JSON.stringify(state));
    return json({ ok: true, state });
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
