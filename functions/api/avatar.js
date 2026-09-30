// ============================================================
// ♥ 文件云函数（Blob 强一致版）：头像 + 背景图
//   GET  /api/avatar?who=liu|hong|bg → 返回图片（data URL）
//   POST /api/avatar {who, data}     → 保存图片并更新版本号让对方刷新
//                                      data 传空字符串 = 删除（恢复默认）
// 部署方式同 state.js：GitHub 仓库导入，无需开通任何存储服务
// ============================================================

import { getStore } from '@edgeone/pages-blob';

const PASSCODE = '';   // 可选口令：和 config.js 里的 SYNC_PASSCODE 填一致才启用

const store = getStore({ name: 'love', consistency: 'strong' });

const KEY_FILE = { liu: 'avatar_liu', hong: 'avatar_hong', bg: 'bg_img' };
const REV_FIELD = { liu: 'avatarLiuRev', hong: 'avatarHongRev', bg: 'bgRev' };
const MAX_LEN = { liu: 400000, hong: 400000, bg: 900000 };

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

// 严格校验：只接受 liu/hong/bg，其他一律拒绝。
// （旧版这里会把不认识的值默认当成 liu，导致背景图被写进对方头像的格子）
function validWho(v) {
  return v === 'hong' ? 'hong' : (v === 'bg' ? 'bg' : (v === 'liu' ? 'liu' : null));
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
    const who = validWho(url.searchParams.get('who'));
    if (!who) return json({ ok: false, error: 'who 参数不对（只能是 liu/hong/bg）' }, 400);
    const data = await store.get(KEY_FILE[who]);
    // v:3 = 新版头像/背景函数（支持 bg）。线上打开 /api/avatar?who=liu 能看到 "v":3 才说明新版生效
    return json({ ok: true, v: 3, data: data || null });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}

export async function onRequestPost({ request }) {
  if (!checkPasscode(request)) return json({ ok: false, error: '口令不对' }, 401);
  try {
    const body = await request.json();
    const who = validWho(body.who);
    if (!who) return json({ ok: false, error: 'who 参数不对（只能是 liu/hong/bg），已拒绝写入，防止写错格子' }, 400);
    const data = String(body.data === undefined ? '' : body.data);
    const rev = Date.now();

    if (data === '') {
      // 空字符串 = 删除，恢复默认
      await store.delete(KEY_FILE[who]);
    } else {
      if (!data.startsWith('data:image/') || data.length > MAX_LEN[who]) {
        return json({ ok: false, error: '图片太大或格式不对' }, 400);
      }
      await store.set(KEY_FILE[who], data);
    }

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
