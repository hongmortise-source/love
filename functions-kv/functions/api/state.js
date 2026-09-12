// ============================================================
// ♥ 共享状态云函数（Blob 强一致版）
//   GET  /api/state  → 读取共享数值
//   POST /api/state  → 更新共享数值（inc=加减，set=直接设置）
// 部署方式：用「GitHub 仓库导入」创建项目（平台会自动安装 package.json
//   里的依赖并构建），无需在控制台开通任何存储服务。
// 数据在控制台「存储 → Blob 存储」页面可以看到，命名空间 love，
//   想把数值清零就删除 couple 对象。
// ============================================================

import { getStore } from '@edgeone/pages-blob';

const PASSCODE = '';   // 可选口令：和 config.js 里的 SYNC_PASSCODE 填一致才启用

// 强一致模式：任何一台手机写入后，对方立刻能读到最新值
const store = getStore({ name: 'love', consistency: 'strong' });

const KEY_STATE = 'couple';
const INITIAL = {
  intimacy: 0, anger: 0, pervert: 0,
  anniversary: '', avatarLiuRev: 0, avatarHongRev: 0, lastAction: null,
};

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

async function readState() {
  const raw = await store.get(KEY_STATE, { type: 'json' });
  if (!raw) return { ...INITIAL };
  return { ...INITIAL, ...raw };
}

function checkPasscode(request) {
  return !PASSCODE || request.headers.get('x-love-code') === PASSCODE;
}

export async function onRequestGet({ request }) {
  if (!checkPasscode(request)) return json({ ok: false, error: '口令不对' }, 401);
  try {
    return json({ ok: true, state: await readState() });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}

export async function onRequestPost({ request }) {
  if (!checkPasscode(request)) return json({ ok: false, error: '口令不对' }, 401);
  try {
    const body = await request.json();
    const state = await readState();

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

    await store.setJSON(KEY_STATE, state);
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
