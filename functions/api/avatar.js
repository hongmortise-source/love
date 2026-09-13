// ============================================================
// ♥ 头像云函数（Blob 强一致版，配合同目录 state.js 使用）
//   GET  /api/avatar?who=liu|hong → 返回头像图片（data URL）
//   POST /api/avatar {who, data}  → 保存头像，并更新头像版本号让对方刷新
// 部署方式同 state.js：GitHub 仓库导入，无需开通任何存储服务
// ============================================================

import { getStore } from '@edgeone/pages-blob';

const PASSCODE = '';   // 可选口令：和 config.js 里的 SYNC_PASSCODE 填一致才启用

const store = getStore({ name: 'love', consistency: 'strong' });

const KEY_AVATAR = { liu: 'avatar_liu', hong: 'avatar_hong' };
const REV_FIELD = { liu: 'avatarLiuRev', hong: 'avatarHongRev' };

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
  const raw = await store.get('couple', { type: 'json' });
  return raw || {};
}

function checkPasscode(request) {
  return !PASSCODE || request.headers.get('x-love-code') === PASSCODE;
}

export async function onRequestGet({ request }) {
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

export async function onRequestPost({ request }) {
  if (!checkPasscode(request)) return json({ ok: false, error: '口令不对' }, 401);
  try {
    const body = await request.json();
    const who = body.who === 'hong' ? 'hong' : 'liu';
    const data = String(body.data || '');
    if (!data.startsWith('data:image/') || data.length > 400000) {
      return json({ ok: false, error: '图片太大或格式不对' }, 400);
    }
    const rev = Date.now();
    await store.set(KEY_AVATAR[who], data);
    const state = await readState();
    state[REV_FIELD[who]] = rev;
    await store.setJSON('couple', state);
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
