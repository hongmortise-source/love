// ============================================================
// ♥ 共享状态云函数（Blob 强一致版）
//   GET  /api/state  → 读取共享数值 + 历史/信件/礼物/成就/愿望池
//   POST /api/state  → 更新：
//     inc          数值加减 {intimacy, anger, pervert}
//     set          直接设置 {anniversary}
//     lastAction   最近的动作（对方轮询到会回放动画）
//     count        动作计数 {heart, hammer, kiss, peek, gift, letter}
//     pushHistory  往时光机加一条 {text, by, type}
//     gift         送出礼物 {id, by}（累计进橱窗）
//     letterNew    写一封信 {from, text}
//     letterRead   标记已读 {id}
//     ideaAdd      愿望池加一条 {text}
//     achNew       记录解锁的成就（单个 {id} 或数组 [{id}]）
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
  counters: { heart: 0, hammer: 0, kiss: 0, peek: 0, gift: 0, letter: 0 },
  history: [], letters: [], gifts: {}, achievements: {}, ideas: null,
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
  if (!raw) return JSON.parse(JSON.stringify(INITIAL));
  const s = { ...INITIAL, ...raw };
  s.counters = { ...INITIAL.counters, ...(raw.counters || {}) };
  s.history = Array.isArray(raw.history) ? raw.history : [];
  s.letters = Array.isArray(raw.letters) ? raw.letters : [];
  s.gifts = raw.gifts && typeof raw.gifts === 'object' ? raw.gifts : {};
  s.achievements = raw.achievements && typeof raw.achievements === 'object' ? raw.achievements : {};
  s.ideas = Array.isArray(raw.ideas) ? raw.ideas : null;
  return s;
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
    const now = Date.now();
    const who = (v) => (v === 'hong' ? 'hong' : 'liu');

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
        by: who(body.lastAction.by),
        ts: Math.round(body.lastAction.ts),
      };
    }
    if (body.count) {
      Object.entries(body.count).forEach(([k, n]) => {
        if (typeof n === 'number' && k in INITIAL.counters) {
          state.counters[k] = Math.max(0, (state.counters[k] || 0) + Math.round(n));
        }
      });
    }
    if (body.pushHistory && typeof body.pushHistory.text === 'string') {
      state.history.unshift({
        text: body.pushHistory.text.slice(0, 80),
        by: who(body.pushHistory.by),
        type: String(body.pushHistory.type || 'sys').slice(0, 12),
        ts: now,
      });
      if (state.history.length > 200) state.history.length = 200;
    }
    if (body.gift && typeof body.gift.id === 'string') {
      const id = body.gift.id.slice(0, 24);
      const g = state.gifts[id] || { c: 0, by: '', ts: 0 };
      g.c += 1;
      g.by = who(body.gift.by);
      g.ts = now;
      state.gifts[id] = g;
    }
    if (body.letterNew && typeof body.letterNew.text === 'string') {
      const text = body.letterNew.text.slice(0, 500).trim();
      if (text) {
        state.letters.unshift({
          id: now + '-' + (body.letterNew.from === 'hong' ? 'h' : 'l'),
          from: who(body.letterNew.from),
          text, ts: now, read: false,
        });
        if (state.letters.length > 50) state.letters.length = 50;
        state.counters.letter = (state.counters.letter || 0) + 1;
      }
    }
    if (body.letterRead && typeof body.letterRead.id === 'string') {
      const L = state.letters.find((x) => x.id === body.letterRead.id);
      if (L) L.read = true;
    }
    if (body.ideaAdd && typeof body.ideaAdd.text === 'string') {
      const t = body.ideaAdd.text.trim().slice(0, 40);
      if (t) {
        if (!Array.isArray(state.ideas)) state.ideas = [];
        if (!state.ideas.includes(t)) {
          state.ideas.push(t);
          if (state.ideas.length > 100) state.ideas.shift();
        }
      }
    }
    if (body.achNew) {
      const list = Array.isArray(body.achNew) ? body.achNew : [body.achNew];
      list.forEach((a) => {
        if (a && typeof a.id === 'string') state.achievements[a.id.slice(0, 24)] = now;
      });
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
