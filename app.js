/* ============================================================
   ♥ 核心逻辑（v2：礼物 / 成就 / 约会 / 时光机 / 信箱 / 换背景）
   ============================================================ */

/* ============================================================
   ♥♥♥ 话术库（想加句子就往对应列表里加，随便加多少条）
   {call} 会自动替换成称呼：洪闻锴说=老婆，刘雨凝说=老公
============================================================ */
const LINES = {
  heart: {
    sender:   ['爱你哟，么么哒 💗', '想你了，给你一颗小心心', '这颗心只属于你一个人', '今天也要甜甜的哦', '接好啦，爱心发射～'],
    receiver: ['收到！加倍爱你 🥰', '哇，好开心呀', '嘿嘿，我也爱你', '爱心已签收，回你十个', '被你甜到了～'],
  },
  hammer: {
    attacker: ['我讨厌你！哼！', '为什么不能陪陪我！', '让你不理我！砸！', '哼，小小惩戒一下', '谁让你这么久不找我'],
    victim:   ['{call}我错了！别打了 🥺', '呜呜，下次不敢了…', '别打别打，疼疼疼', '啊——饶命饶命', '轻点轻点，我又不是{call}的仇人'],
  },
  kiss: {
    sender:   ['么——接住我的飞吻 💋', '送你一个甜甜的吻', '啵啵啵，全部都给你', '这个吻有保质期：永远'],
    receiver: ['哇，接住了，脸好红', '回亲一个！啵 💋', '嘿嘿，亲亲收好啦', '不许只亲一下！'],
  },
  peek: {
    asker:   ['嘿嘿，让我好好看看 👀', '就想看看你嘛', '看一眼，就看一眼', '好看，多看两秒'],
    target:  ['变态！…但只许你看 😳', '不许看！…好吧给你看', '看什么看，脸都红了', '再看你也要负责的哦'],
  },
  gift: {
    sender:   ['送你！喜欢吗 💝', '这可是我攒了好久亲密值买的', '小小心意，必须收下', '看到它就想到你，就买下来了'],
    receiver: ['哇！！好喜欢 🥰', '{call}最好了！', '收下啦，么么哒', '天呐，我要炫耀给全世界看'],
  },
  idea: {
    asker:   ['这周就去这个，好不好', '看！我抽到的约会', '安排上了，不许反悔'],
    target:  ['好呀好呀！', '一言为定哦 🤝', '嘿嘿，期待期待'],
  },
};

/* ---------------- 用户与动作定义 ---------------- */

const USERS = {
  liu:  { name: '刘雨凝', call: '老公', avatarKey: 'avatarLiu' },
  hong: { name: '洪闻锴', call: '老婆', avatarKey: 'avatarHong' },
};

const ACTION_LABEL = {
  heart:  '送了你一颗爱心 💖',
  hammer: '锤了你一下 🔨',
  kiss:   '飞吻了你一个 😘',
  peek:   '偷偷看了看你 👀',
  gift:   '送了你一份礼物 🎁',
  letter: '给你写了一封信 ✉️',
};

const ROLE = {
  heart: ['sender', 'receiver'], hammer: ['attacker', 'victim'],
  kiss: ['sender', 'receiver'], peek: ['asker', 'target'],
  gift: ['sender', 'receiver'], idea: ['asker', 'target'],
};

const STAT_LABEL = { intimacy: '亲密值', anger: '怒气值', pervert: '变态值' };

const HIST_TEXT = {
  heart: '送出了一颗爱心', hammer: '抡起了锤子', kiss: '飞来一个吻', peek: '偷偷看了对方一眼',
};
const HIST_ICON = {
  heart: '💖', hammer: '🔨', kiss: '😘', peek: '👀', gift: '🎁', letter: '✉️',
  idea: '💡', anniv: '💘', bg: '🖼', sys: '✨',
};

/* ---------------- 状态 ---------------- */

const state = {
  intimacy: 0, anger: 0, pervert: 0, anniversary: null,
  avatarLiu: '', avatarHong: '', lastAction: null,
  counters: { heart: 0, hammer: 0, kiss: 0, peek: 0, gift: 0, letter: 0 },
  history: [], letters: [], gifts: {}, achievements: {}, ideas: null,
  bg: '',
};
let me = localStorage.getItem('love_me') || null;
let fxBusy = false;
let lastSeenActionTs = 0;
let achvUnviewed = false;

const $ = (id) => document.getElementById(id);
const fxLayer = $('fx-layer');
const partnerOf = (u) => (u === 'liu' ? 'hong' : 'liu');
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const fillCall = (s, user) => s.replace(/\{call\}/g, USERS[user].call);

function fmtTs(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function daysCount() {
  if (!state.anniversary) return 0;
  const start = new Date(state.anniversary + 'T00:00:00');
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000));
}

/* ============================================================
   云端同步（部署到 EdgeOne Pages 后自动启用，走 /api 云函数 + Blob）
   网页会自动探测：连得上就是云端模式，连不上就是本地模式
============================================================ */

const Cloud = {
  available: null,   // null=还没探测  true=云端可用  false=本地模式
  headers() {
    const h = {};
    if (CONFIG.SYNC_PASSCODE) h['x-love-code'] = CONFIG.SYNC_PASSCODE;
    return h;
  },
  async detect() {
    try {
      const r = await fetch('/api/state', { headers: this.headers() });
      const d = await r.json();
      this.available = !!(d && d.ok);
    } catch (e) {
      this.available = false;
    }
    return this.available;
  },
  get ok() { return this.available === true; },
  async getState() {
    const r = await fetch('/api/state', { headers: this.headers() });
    if (!r.ok) throw new Error('state ' + r.status);
    const d = await r.json();
    if (!d.ok) throw new Error('state api');
    return d.state;
  },
  async writeState(body) {
    const r = await fetch('/api/state', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, this.headers()),
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error('write ' + r.status);
    const d = await r.json();
    if (!d.ok) throw new Error('write api');
    return d.state;
  },
  async writeAvatar(who, data) {
    const r = await fetch('/api/avatar', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, this.headers()),
      body: JSON.stringify({ who, data }),
    });
    if (!r.ok) throw new Error('avatar ' + r.status);
    const d = await r.json();
    if (!d.ok) throw new Error('avatar api');
    return d.rev;
  },
  async getAvatar(who) {
    const r = await fetch('/api/avatar?who=' + who, { headers: this.headers() });
    if (!r.ok) throw new Error('avatar ' + r.status);
    const d = await r.json();
    if (!d.ok) throw new Error('avatar api');
    return d.data;
  },
};

/* 头像/背景版本号缓存：变了才去云端拉图 */
const revCache = { liu: 0, hong: 0, bg: 0 };

/* ---------------- 本地缓存 ---------------- */

function saveLocal() {
  try {
    localStorage.setItem('love_state', JSON.stringify({
      intimacy: state.intimacy, anger: state.anger, pervert: state.pervert,
      anniversary: state.anniversary, avatarLiu: state.avatarLiu, avatarHong: state.avatarHong,
      lastAction: state.lastAction, revCache,
      counters: state.counters, history: state.history.slice(0, 60),
      letters: state.letters.slice(0, 20), gifts: state.gifts,
      achievements: state.achievements, ideas: state.ideas, bg: state.bg,
    }));
  } catch (e) { /* 存储满了就算了 */ }
}

function loadLocal() {
  try {
    const d = JSON.parse(localStorage.getItem('love_state') || '{}');
    ['intimacy', 'anger', 'pervert'].forEach((k) => { if (typeof d[k] === 'number') state[k] = d[k]; });
    if (d.anniversary) state.anniversary = d.anniversary;
    if (d.avatarLiu) state.avatarLiu = d.avatarLiu;
    if (d.avatarHong) state.avatarHong = d.avatarHong;
    if (d.lastAction) state.lastAction = d.lastAction;
    if (d.revCache) Object.assign(revCache, d.revCache);
    if (d.counters) state.counters = { ...state.counters, ...d.counters };
    if (Array.isArray(d.history)) state.history = d.history;
    if (Array.isArray(d.letters)) state.letters = d.letters;
    if (d.gifts) state.gifts = d.gifts;
    if (d.achievements) state.achievements = d.achievements;
    if (Array.isArray(d.ideas)) state.ideas = d.ideas;
    if (d.bg) state.bg = d.bg;
  } catch (e) { /* 忽略坏数据 */ }
}

/* ---------------- 云端数据合并 ---------------- */

let cloudReady = false;

/* 把云端数据合并进页面（云端是权威数值） */
function adoptServer(st) {
  ['intimacy', 'anger', 'pervert'].forEach((k) => {
    state[k] = Math.max(0, Math.round(Number(st[k]) || 0));
  });
  state.anniversary = st.anniversary || null;
  state.counters = { ...state.counters, ...(st.counters || {}) };
  state.history = Array.isArray(st.history) ? st.history : [];
  state.letters = Array.isArray(st.letters) ? st.letters : [];
  state.gifts = st.gifts || {};
  state.achievements = st.achievements || {};
  state.ideas = Array.isArray(st.ideas) ? st.ideas : null;
  let la = st.lastAction;
  if (typeof la === 'string') { try { la = JSON.parse(la); } catch (e) { la = null; } }
  state.lastAction = la || null;

  maybeFetchImages(st);

  const ts = (la && la.ts) || 0;
  if (!cloudReady) {
    lastSeenActionTs = ts;   // 首次进入不回放历史动作
    cloudReady = true;
  } else if (la && la.ts > lastSeenActionTs && la.by !== me) {
    lastSeenActionTs = la.ts;
    remoteReplay(la);
  }
  renderAll();
  checkAchievements();
}

/* 头像/背景版本号变了才去云端拉图 */
let imagesFetched = false;
async function maybeFetchImages(st) {
  const map = [
    { who: 'liu', rev: st.avatarLiuRev || 0, key: 'avatarLiu', render: renderAvatars },
    { who: 'hong', rev: st.avatarHongRev || 0, key: 'avatarHong', render: renderAvatars },
    { who: 'bg', rev: st.bgRev || 0, key: 'bg', render: renderBg },
  ];
  for (const it of map) {
    // 版本号变了要拉取；版本号为 0（云端没有图）且本地还留着图时，也要同步清掉
    if (it.rev !== revCache[it.who] || (!it.rev && state[it.key])) {
      try {
        const data = await Cloud.getAvatar(it.who);
        state[it.key] = data || '';
        revCache[it.who] = it.rev;
        saveLocal();
        it.render();
      } catch (e) { /* 下次轮询再取 */ }
    }
  }
  imagesFetched = true;
}

async function refreshFromCloud(notifyError) {
  if (!Cloud.ok || fxBusy) return;
  try {
    adoptServer(await Cloud.getState());
  } catch (e) {
    if (notifyError) toast('云端连接失败，先用本地数据');
  }
}

function remoteReplay(la) {
  const name = USERS[la.by] ? USERS[la.by].name : '对方';
  toast(`${name} ${ACTION_LABEL[la.type] || ''}`);
  if (fxBusy) return;
  if (la.type === 'letter') return;   // 信件只提示，信箱角标会亮
  playEffect(la.type, la.by, true).catch(() => {});
  if (LINES[la.type]) maybeSpeak(la.type, la.by, 600);
}

/* ---------------- 渲染 ---------------- */

function renderAll() {
  renderStats(); renderDays(); renderAvatars(); renderBg(); renderBadges(); renderOpenSheets();
}

function renderStats() {
  $('stat-intimacy').textContent = state.intimacy;
  $('stat-anger').textContent = state.anger;
  $('stat-pervert').textContent = state.pervert;
}

function renderDays() {
  const v = $('days-value'), hint = $('days-hint');
  if (!state.anniversary) { v.textContent = '--'; hint.textContent = '点我设置纪念日'; return; }
  v.textContent = daysCount();
  hint.textContent = '从 ' + state.anniversary + ' 起';
}

function renderAvatars() {
  const set = (imgId, val, def) => { $(imgId).src = val || def; };
  set('img-liu', state.avatarLiu, CONFIG.DEFAULT_AVATAR.liu);
  set('img-hong', state.avatarHong, CONFIG.DEFAULT_AVATAR.hong);
  set('lc-img-liu', state.avatarLiu, CONFIG.DEFAULT_AVATAR.liu);
  set('lc-img-hong', state.avatarHong, CONFIG.DEFAULT_AVATAR.hong);
}

function renderBg() {
  document.body.classList.toggle('has-bg', !!state.bg);
  $('bg-layer').style.backgroundImage = state.bg ? `url("${state.bg}")` : '';
}

function renderBadges() {
  const unread = state.letters.filter((l) => !l.read && l.from !== me).length;
  const badge = $('mail-badge');
  badge.hidden = unread === 0;
  badge.textContent = unread > 9 ? '9+' : String(unread);
  $('dot-achv').classList.toggle('hidden', !achvUnviewed);
}

/* 打开着的面板同步刷新（没打开的不浪费渲染） */
function renderOpenSheets() {
  if (!$('sheet-gift').classList.contains('hidden')) renderGiftShop();
  if (!$('sheet-achv').classList.contains('hidden')) renderAchv();
  if (!$('sheet-time').classList.contains('hidden')) renderTimeline();
  if (!$('sheet-mail').classList.contains('hidden')) renderMail();
  if (!$('sheet-idea').classList.contains('hidden')) renderIdeaPool();
}

function applyMine() {
  $('block-liu').classList.toggle('mine', me === 'liu');
  $('block-hong').classList.toggle('mine', me === 'hong');
}

function showLogin() { $('login-page').classList.remove('hidden'); $('main-page').classList.add('hidden'); }
function showMain() { $('login-page').classList.add('hidden'); $('main-page').classList.remove('hidden'); applyMine(); renderAll(); }

/* ---------------- Toast ---------------- */

let toastTimer = null;
function toast(msg, ms = 2400) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}
function toastOnce(key, msg) {
  if (sessionStorage.getItem('toast_' + key)) return;
  sessionStorage.setItem('toast_' + key, '1');
  toast(msg, 3400);
}

/* ============================================================
   特效
============================================================ */

/* 让动画在老内核上也能凑合跑的兜底 */
function animate(el, frames, opts) {
  if (el.animate) {
    // fill forwards：动画结束保持最后一帧，避免多段动画之间闪回起点
    const a = el.animate(frames, { ...opts, fill: 'forwards' });
    return a.finished.catch(() => {});
  }
  return new Promise((res) => {
    const to = frames[frames.length - 1].transform || '';
    el.style.transition = 'transform ' + (opts.duration || 300) + 'ms ease';
    requestAnimationFrame(() => { el.style.transform = to; });
    setTimeout(() => { el.style.transition = ''; res(); }, (opts.duration || 300) + 40);
  });
}

function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function spawn(cls, x, y, inner) {
  const d = document.createElement('div');
  d.className = cls;
  d.innerHTML = inner;
  d.style.left = x + 'px';
  d.style.top = y + 'px';
  fxLayer.appendChild(d);
  return d;
}

const avatarEl = (user) => $('block-' + user).querySelector('.avatar-wrap');

async function flyEmoji(cls, emoji, from, to, opts = {}) {
  const { lift = 90, dur = 950 } = opts;
  const el = spawn(cls, from.x, from.y, emoji);
  const dx = to.x - from.x, dy = to.y - from.y;
  await animate(el, [
    { transform: 'translate(0,0) scale(.4)', opacity: .4 },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - lift}px) scale(1.35)`, opacity: 1, offset: .55 },
    { transform: `translate(${dx}px, ${dy}px) scale(1)`, opacity: 1 },
  ], { duration: dur, easing: 'ease-in-out' });
  el.remove();
}

function burst(center, emoji, n) {
  for (let i = 0; i < n; i++) {
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.6;
    const dist = 42 + Math.random() * 42;
    const el = spawn('fx-mini', center.x, center.y, emoji);
    animate(el, [
      { transform: 'translate(0,0) scale(.5)', opacity: 1 },
      { transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist - 26}px) scale(1.1) rotate(${Math.random() * 160 - 80}deg)`, opacity: 0 },
    ], { duration: 620 + Math.random() * 320, easing: 'cubic-bezier(.2,.7,.4,1)' }).then(() => el.remove());
  }
}

function ripple(center) {
  [0, 160].forEach((delay) => {
    setTimeout(() => {
      const el = spawn('ripple', center.x, center.y, '');
      animate(el, [
        { transform: 'scale(.3)', opacity: 1 },
        { transform: 'scale(2.5)', opacity: 0 },
      ], { duration: 720, easing: 'ease-out' }).then(() => el.remove());
    }, delay);
  });
}

function impactFeedback(target) {
  const boom = spawn('fx-boom', target.x, target.y, '💥');
  animate(boom, [
    { transform: 'scale(.4)', opacity: 1 },
    { transform: 'scale(1.5)', opacity: 0 },
  ], { duration: 560, easing: 'ease-out' }).then(() => boom.remove());
  document.body.classList.add('shake');
  setTimeout(() => document.body.classList.remove('shake'), 480);
  burst(target, '💔', 4);
}

/* 新版锤子：从自己头像上方伸出大锤，举高蓄力后抡一个半圆砸到对方头上 */
async function hammerSwing(actor) {
  const A = centerOf(avatarEl(actor));
  const T = centerOf(avatarEl(partnerOf(actor)));
  const dir = T.x >= A.x ? 1 : -1;                       // 对方在右边就顺时针抡，左边就反向
  const el = spawn('fx-hammer', A.x + dir * 6, A.y - 88, '🔨');
  // 从举起位置到对方头顶的总位移
  const dx = T.x - (A.x + dir * 6);
  const dy = T.y - (A.y - 88);
  const lift = Math.min(150, Math.abs(dx) * 0.6 + 60);   // 弧顶高度

  await animate(el, [
    // 1. 从头像上方冒出来，高高举起
    { transform: `translate(0,26px) rotate(${dir * -30}deg) scale(.25)`, opacity: 0 },
    { transform: `translate(0,0) rotate(${dir * -118}deg) scale(1)`, opacity: 1, offset: .3 },
    // 2. 蓄力一瞬，再向后仰一点
    { transform: `translate(${-dir * 8}px, -14px) rotate(${dir * -142}deg) scale(1)`, offset: .48 },
    // 3. 抡起半圆飞向对方头顶（中点抬高走弧线）
    { transform: `translate(${dx * 0.55}px, ${dy * 0.55 - lift}px) rotate(${dir * -20}deg) scale(1.12)`, offset: .78 },
    // 4. 砸在对方头顶
    { transform: `translate(${dx}px, ${dy}px) rotate(${dir * 26}deg) scale(1.18)` },
  ], { duration: 780, easing: 'cubic-bezier(.6, .05, .85, .5)' });

  impactFeedback(T);
  const av = avatarEl(partnerOf(actor));
  av.classList.remove('squish'); void av.offsetWidth; av.classList.add('squish');

  animate(el, [
    { transform: `translate(${dx}px, ${dy}px) rotate(${dir * 26}deg) scale(1.18)`, opacity: 1 },
    { transform: `translate(${dx}px, ${dy}px) rotate(${dir * 26}deg) scale(1.18)`, opacity: 0 },
  ], { duration: 280, delay: 160 }).then(() => el.remove());
}

async function playEffect(type, actor, silent) {
  const src = centerOf(avatarEl(actor));
  const dst = centerOf(avatarEl(partnerOf(actor)));
  if (type === 'heart') {
    await flyEmoji('fx-heart', '💖', src, dst);
    burst(dst, '💗', 8);
  } else if (type === 'kiss') {
    await flyEmoji('fx-kiss', '😘', src, dst, { lift: 110 });
    ripple(dst);
    burst(dst, '💋', 5);
  } else if (type === 'hammer') {
    await hammerSwing(actor);
  } else if (type === 'peek') {
    await flyEmoji('fx-heart', '👀', src, dst, { lift: 70, dur: 700 });
    if (!silent) openPeek();
  } else if (type === 'gift') {
    await flyEmoji('fx-heart', '🎁', src, dst, { lift: 80 });
    burst(dst, '💝', 6);
  } else if (type === 'letter') {
    await flyEmoji('fx-heart', '✉️', src, dst, { lift: 80, dur: 800 });
  }
}

function floatNum(el, text, down) {
  const c = centerOf(el);
  const f = spawn('float-num' + (down ? ' down' : ''), c.x, c.y - 8, text);
  animate(f, [
    { transform: 'translate(0,0)', opacity: 1 },
    { transform: 'translate(0,-48px)', opacity: 0 },
  ], { duration: 1100, easing: 'ease-out' }).then(() => f.remove());
}

/* ============================================================
   话术
============================================================ */

const speakTimers = {};

function speak(user, text) {
  const b = $('bubble-' + user);
  clearTimeout(speakTimers[user]);
  b.textContent = text;
  b.classList.add('show');
  speakTimers[user] = setTimeout(() => b.classList.remove('show'), 3000);
}

function maybeSpeak(type, actor, baseDelay = 420) {
  const pair = ROLE[type];
  if (!pair) return;
  const trySpeak = (user, role, delay) => {
    setTimeout(() => {
      if (Math.random() < CONFIG.LINE_CHANCE) speak(user, fillCall(pick(LINES[type][role]), user));
    }, delay);
  };
  trySpeak(actor, pair[0], baseDelay);
  trySpeak(partnerOf(actor), pair[1], baseDelay + 950);
}

/* ============================================================
   动作主流程（四个基础按钮）
============================================================ */

function applyDeltas(d) {
  const floats = [];
  ['intimacy', 'anger', 'pervert'].forEach((k) => {
    if (!d[k]) return;
    const before = state[k];
    state[k] = Math.max(0, state[k] + d[k]);
    if (state[k] !== before) floats.push([k, state[k] - before]);
  });
  return floats;
}

async function doAction(type) {
  if (!me) { showLogin(); return; }
  if (fxBusy) return;
  fxBusy = true;

  const floats = applyDeltas(CONFIG.RULES[type]);
  renderStats();
  floats.forEach(([k, dv]) => {
    const card = $(k === 'intimacy' ? 'stat-intimacy' : k === 'anger' ? 'stat-anger' : 'stat-pervert').closest('.stat-card');
    floatNum(card, (dv > 0 ? '+' : '') + dv + ' ' + STAT_LABEL[k], dv < 0);
  });

  try {
    await playEffect(type, me);
  } catch (e) { /* 特效失败不影响数值 */ }

  maybeSpeak(type, me);

  state.lastAction = { type, by: me, ts: Date.now() };
  lastSeenActionTs = state.lastAction.ts;
  state.counters[type] = (state.counters[type] || 0) + 1;
  state.history.unshift({ text: HIST_TEXT[type], by: me, type, ts: Date.now() });
  saveLocal();
  syncAction(CONFIG.RULES[type], type);

  setTimeout(() => { fxBusy = false; }, 500);
}

async function syncAction(d, type) {
  if (!Cloud.ok) return;
  try {
    adoptServer(await Cloud.writeState({
      inc: d,
      lastAction: state.lastAction,
      count: { [type]: 1 },
      pushHistory: { text: HIST_TEXT[type], by: me, type },
    }));
  } catch (e) {
    toast('网络开小差了，数值稍后会补同步');
    setTimeout(() => syncAction(d, type), 4000);
  }
}

/* ============================================================
   礼物小铺
============================================================ */

let giftPending = null;

function renderGiftShop() {
  const grid = $('gift-grid');
  grid.innerHTML = '';
  CONFIG.GIFTS.forEach((g) => {
    const b = document.createElement('button');
    b.className = 'gift-item' + (state.intimacy < g.price ? ' poor' : '');
    b.innerHTML = `<span class="g-emoji">${g.emoji}</span><span class="g-name">${g.name}</span><span class="g-price">💗${g.price}</span>`;
    b.addEventListener('click', () => selectGift(g));
    grid.appendChild(b);
  });

  const show = $('gift-show');
  const owned = Object.entries(state.gifts).map(([id, info]) => {
    const g = CONFIG.GIFTS.find((x) => x.id === id);
    return g ? { g, info } : null;
  }).filter(Boolean);
  if (!owned.length) { show.innerHTML = '<p class="empty-tip">还没送过礼物哦～</p>'; }
  else {
    show.innerHTML = owned.map(({ g, info }) =>
      `<div class="gift-owned"><span class="g-emoji">${g.emoji}</span><span class="g-count">×${info.c}</span><span class="g-by">${info.by === 'liu' ? '刘雨凝' : '洪闻锴'} 送的</span></div>`
    ).join('');
  }
}

function selectGift(g) {
  if (state.intimacy < g.price) { toast(`亲密值不够呀，先攒攒爱心（还差 ${g.price - state.intimacy}）💗`); return; }
  giftPending = g;
  $('gift-confirm-text').textContent = `把 ${g.emoji}${g.name} 送给对方，花费 ${g.price} 亲密值？`;
  $('gift-confirm').classList.remove('hidden');
}

async function buyGift() {
  const g = giftPending;
  giftPending = null;
  $('gift-confirm').classList.add('hidden');
  if (!g || !me || fxBusy) return;
  fxBusy = true;

  state.intimacy = Math.max(0, state.intimacy - g.price);
  state.counters.gift = (state.counters.gift || 0) + 1;
  const info = state.gifts[g.id] || { c: 0, by: '', ts: 0 };
  info.c += 1; info.by = me; info.ts = Date.now();
  state.gifts[g.id] = info;
  state.lastAction = { type: 'gift', by: me, ts: Date.now() };
  lastSeenActionTs = state.lastAction.ts;
  state.history.unshift({ text: `送出了${g.name}${g.emoji}`, by: me, type: 'gift', ts: Date.now() });
  renderAll();
  saveLocal();

  await playEffect('gift', me, true);
  maybeSpeak('gift', me);

  if (Cloud.ok) {
    try {
      adoptServer(await Cloud.writeState({
        inc: { intimacy: -g.price },
        count: { gift: 1 },
        gift: { id: g.id, by: me },
        lastAction: state.lastAction,
        pushHistory: { text: `送出了${g.name}${g.emoji}`, by: me, type: 'gift' },
      }));
    } catch (e) { toast('网络开小差了，礼物稍后补同步'); }
  }
  toast(`${g.emoji} ${g.name} 已送出！`);
  setTimeout(() => { fxBusy = false; }, 400);
}

/* ============================================================
   成就
============================================================ */

function achvValue(a) {
  if (a.type === 'intimacy') return state.intimacy;
  if (a.type === 'days') return daysCount();
  return state.counters[a.type] || 0;
}

function checkAchievements() {
  if (!me) return;
  const news = [];
  CONFIG.ACHIEVEMENTS.forEach((a) => {
    if (!state.achievements[a.id] && achvValue(a) >= a.n) {
      state.achievements[a.id] = Date.now();
      news.push(a);
    }
  });
  if (!news.length) return;
  achvUnviewed = true;
  renderBadges();
  celebrateQueue.push(...news);
  pumpCelebrate();
  if (Cloud.ok) {
    Cloud.writeState({ achNew: news.map((a) => ({ id: a.id })) }).catch(() => {});
  }
  saveLocal();
}

const celebrateQueue = [];
let celebrating = false;

function pumpCelebrate() {
  if (celebrating || !celebrateQueue.length) return;
  celebrating = true;
  const a = celebrateQueue.shift();
  $('achv-c-icon').textContent = a.icon;
  $('achv-c-name').textContent = a.name;
  $('achv-c-desc').textContent = a.desc;
  const layer = $('achv-celebrate');
  layer.classList.remove('hidden');
  const c = { x: innerWidth / 2, y: innerHeight / 2 };
  burst(c, '🎉', 8);
  setTimeout(() => burst(c, '✨', 6), 350);
  setTimeout(() => {
    layer.classList.add('hidden');
    celebrating = false;
    pumpCelebrate();
  }, 2700);
}

function renderAchv() {
  const list = $('achv-list');
  list.innerHTML = '';
  let got = 0;
  CONFIG.ACHIEVEMENTS.forEach((a) => {
    const unlocked = !!state.achievements[a.id];
    if (unlocked) got++;
    const v = Math.min(achvValue(a), a.n);
    const row = document.createElement('div');
    row.className = 'achv-row' + (unlocked ? ' got' : ' locked');
    row.innerHTML =
      `<div class="a-face">${a.icon}</div>` +
      `<div class="achv-info"><div class="achv-name">${a.name}</div><div class="achv-desc">${a.desc}</div>` +
      (unlocked ? '' : `<div class="achv-bar"><i style="width:${Math.round((v / a.n) * 100)}%"></i></div>`) +
      `</div>` +
      `<div class="achv-state">${unlocked ? '已解锁 ✓' : v + '/' + a.n}</div>`;
    list.appendChild(row);
  });
  $('achv-progress-tip').textContent = `已解锁 ${got} / ${CONFIG.ACHIEVEMENTS.length} 枚徽章`;
}

/* ============================================================
   约会提案
============================================================ */

function ideaPool() {
  return (state.ideas && state.ideas.length) ? state.ideas : CONFIG.DATE_IDEAS;
}

let currentIdea = null;

function drawIdea() {
  currentIdea = pick(ideaPool());
  $('idea-emoji').textContent = '💡';
  $('idea-text').textContent = currentIdea;
  $('idea-hint').textContent = '喜欢就定下来，不喜欢就换一个';
  $('idea-draw').classList.add('hidden');
  $('idea-redraw').classList.remove('hidden');
  $('idea-lock').classList.remove('hidden');
}

async function lockIdea() {
  if (!currentIdea || !me) return;
  const text = `约会提案：${currentIdea}`;
  state.history.unshift({ text, by: me, type: 'idea', ts: Date.now() });
  saveLocal();
  if (Cloud.ok) {
    try {
      adoptServer(await Cloud.writeState({ pushHistory: { text, by: me, type: 'idea' } }));
    } catch (e) { /* 下次同步 */ }
  }
  toast('约会提案已敲定，写进时光机啦 💡');
  closeSheet('sheet-idea');
  resetIdeaUI();
}

async function addIdea() {
  const input = $('idea-input');
  const text = input.value.trim();
  if (!text) { toast('先写点什么吧'); return; }
  input.value = '';
  if (Cloud.ok) {
    try {
      adoptServer(await Cloud.writeState({ ideaAdd: { text } }));
    } catch (e) { toast('加进去了，云端稍后同步'); state.ideas = [...(state.ideas || []), text]; }
  } else {
    state.ideas = [...(state.ideas || []), text];
    saveLocal();
  }
  toast('已加入愿望池 ✨');
  renderIdeaPool();
}

function renderIdeaPool() {
  const n = ideaPool().length;
  $('idea-pool-tip').textContent = `愿望池里现在有 ${n} 个点子（含默认）`;
}

function resetIdeaUI() {
  currentIdea = null;
  $('idea-emoji').textContent = '🎲';
  $('idea-text').textContent = '点下面抽一个约会点子';
  $('idea-hint').textContent = '';
  $('idea-draw').classList.remove('hidden');
  $('idea-redraw').classList.add('hidden');
  $('idea-lock').classList.add('hidden');
}

/* ============================================================
   时光机
============================================================ */

function renderTimeline() {
  const box = $('timeline');
  box.innerHTML = '';
  const items = state.history;
  $('timeline-empty').hidden = items.length > 0;
  items.forEach((h) => {
    const row = document.createElement('div');
    row.className = 'tl-item';
    const icon = HIST_ICON[h.type] || '✨';
    const who = USERS[h.by] ? USERS[h.by].name : '我们';
    row.innerHTML =
      `<div class="tl-rail"><div class="tl-icon">${icon}</div><div class="tl-line"></div></div>` +
      `<div class="tl-main"><div class="tl-text">${who} ${h.text || ''}</div><div class="tl-time">${fmtTs(h.ts)}</div></div>`;
    box.appendChild(row);
  });
}

/* ============================================================
   小信箱
============================================================ */

function renderMail() {
  const list = $('letter-list');
  list.innerHTML = '';
  $('letter-empty').hidden = state.letters.length > 0;
  state.letters.forEach((L) => {
    const mine = L.from === me;
    const unread = !L.read && !mine;
    const item = document.createElement('button');
    item.className = 'mail-item' + (unread ? ' unread' : '');
    item.innerHTML =
      `<span class="mail-face">${unread ? '💌' : '✉️'}</span>` +
      `<span class="mail-mid"><span class="mail-from">${USERS[L.from] ? USERS[L.from].name : '?'} 写的</span>` +
      `<span class="mail-prev">${L.text.slice(0, 26)}</span></span>` +
      `<span class="mail-state">${mine ? (L.read ? '已读 ✓' : '未读') : (unread ? '新 ✦' : '已读')}</span>`;
    item.addEventListener('click', () => openLetter(L));
    list.appendChild(item);
  });
}

async function openLetter(L) {
  $('letter-meta').textContent = `${USERS[L.from] ? USERS[L.from].name : '?'} · ${fmtTs(L.ts)}`;
  $('letter-text').textContent = L.text;
  $('letter-list').classList.add('hidden');
  $('letter-empty').classList.add('hidden');
  $('letter-detail').classList.remove('hidden');
  if (!L.read && L.from !== me) {
    L.read = true;
    renderBadges();
    if (Cloud.ok) Cloud.writeState({ letterRead: { id: L.id } }).catch(() => {});
  }
}

async function sendLetter() {
  const ta = $('letter-textarea');
  const text = ta.value.trim();
  if (!text) { toast('写点什么再寄吧～'); return; }
  if (!me) return;
  ta.value = '';
  const ts = Date.now();
  state.letters.unshift({ id: ts + '-tmp', from: me, text, ts, read: false });
  state.counters.letter = (state.counters.letter || 0) + 1;
  state.history.unshift({ text: '寄出了一封信', by: me, type: 'letter', ts });
  state.lastAction = { type: 'letter', by: me, ts };
  lastSeenActionTs = ts;
  renderAll();
  saveLocal();
  toast('信已寄出 💌');
  flyEmoji('fx-heart', '✉️', centerOf(avatarEl(me)), centerOf(avatarEl(partnerOf(me))), { lift: 80, dur: 800 });
  if (Cloud.ok) {
    try {
      adoptServer(await Cloud.writeState({
        letterNew: { from: me, text },
        lastAction: state.lastAction,
        pushHistory: { text: '寄出了一封信', by: me, type: 'letter' },
      }));
    } catch (e) { toast('网络开小差了，信稍后补寄'); }
  }
  checkAchievements();
}

/* ============================================================
   面板开关
============================================================ */

function openSheet(id) {
  $(id).classList.remove('hidden');
  if (id === 'sheet-gift') renderGiftShop();
  if (id === 'sheet-achv') { renderAchv(); achvUnviewed = false; renderBadges(); }
  if (id === 'sheet-idea') renderIdeaPool();
  if (id === 'sheet-time') renderTimeline();
  if (id === 'sheet-mail') {
    $('letter-detail').classList.add('hidden');
    $('letter-list').classList.remove('hidden');
    $('letter-empty').hidden = state.letters.length > 0;
    renderMail();
  }
}

function closeSheet(id) { $(id).classList.add('hidden'); }

/* ============================================================
   背景粒子
============================================================ */

function buildBackground() {
  const stars = $('stars');
  for (let i = 0; i < 70; i++) {
    const s = document.createElement('i');
    s.className = 'star';
    const size = 1 + Math.random() * 1.8;
    s.style.cssText = `left:${Math.random() * 100}vw;top:${Math.random() * 100}vh;width:${size}px;height:${size}px;animation-duration:${2 + Math.random() * 2.6}s;animation-delay:${-Math.random() * 4}s;`;
    stars.appendChild(s);
  }
  const petals = $('petals');
  const kinds = ['🌸', '💗', '✨', '🌷'];
  for (let i = 0; i < 12; i++) {
    const p = document.createElement('i');
    p.className = 'petal';
    p.textContent = kinds[i % kinds.length];
    p.style.cssText = `left:${Math.random() * 100}vw;font-size:${12 + Math.random() * 12}px;animation-duration:${9 + Math.random() * 8}s;animation-delay:${-Math.random() * 18}s;opacity:${0.45 + Math.random() * 0.4};`;
    petals.appendChild(p);
  }
}

/* ============================================================
   音乐
============================================================ */

const audio = new Audio();
audio.loop = true;
let songIdx = 0;
let musicStarted = false;
let musicPausedByUser = false;

function currentSong() { return CONFIG.MUSIC_LIST[songIdx]; }

function updateMusicUI(playing) {
  $('music-btn').classList.toggle('playing', playing);
  $('music-btn').textContent = playing ? '♫' : '♪';
}

function playMusic() {
  if (!CONFIG.MUSIC_LIST.length) return;
  const src = currentSong().url;
  if (!audio.src || !audio.src.endsWith(src)) audio.src = src;
  audio.play().then(() => { musicStarted = true; updateMusicUI(true); })
    .catch(() => { updateMusicUI(false); if (musicStarted) toast('音乐文件还没放进去哦（assets/music.mp3）'); });
}

function pauseMusic() { audio.pause(); updateMusicUI(false); }

function bindMusic() {
  $('next-song').hidden = CONFIG.MUSIC_LIST.length < 2;
  $('music-btn').addEventListener('click', () => {
    if (audio.paused) { musicPausedByUser = false; playMusic(); }
    else { musicPausedByUser = true; pauseMusic(); }
  });
  $('next-song').addEventListener('click', () => {
    songIdx = (songIdx + 1) % CONFIG.MUSIC_LIST.length;
    audio.src = currentSong().url;
    toast('♪ ' + currentSong().title);
    if (!musicPausedByUser) playMusic();
  });
  // 微信浏览器禁止自动播放：用户第一次碰屏幕时开始放
  const firstGesture = () => { if (!musicStarted && !musicPausedByUser) playMusic(); };
  document.addEventListener('touchstart', firstGesture, { once: true, passive: true });
  document.addEventListener('click', firstGesture, { once: true });
}

/* ============================================================
   弹窗：纪念日 / 看看你的 / 头像 / 背景
============================================================ */

function openAnniv() {
  $('anniv-input').value = state.anniversary || '';
  $('anniv-modal').classList.remove('hidden');
}

async function saveAnniv() {
  const v = $('anniv-input').value;
  if (!v) { toast('选一个日子吧'); return; }
  state.anniversary = v;
  renderDays();
  saveLocal();
  $('anniv-modal').classList.add('hidden');
  if (Cloud.ok) {
    try {
      adoptServer(await Cloud.writeState({
        set: { anniversary: v },
        pushHistory: { text: `把纪念日设为 ${v}`, by: me, type: 'anniv' },
      }));
      toast('纪念日已保存，对方也看到啦 💘');
    } catch (e) { toast('已保存本地，云端同步失败'); }
  }
  else toast('纪念日已保存 💘');
  checkAchievements();
}

function openPeek() {
  $('peek-title').textContent = '让我看看你的' + pick(CONFIG.PEEK_PARTS) + '…';
  $('peek-sub').textContent = '就一眼，就一眼 👉 变态值 +10';
  $('peek-modal').classList.remove('hidden');
}

/* 图片压缩：头像 320px，背景 900px */
function compressImage(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) {
          const scale = maxSize / Math.max(w, h);
          w = Math.round(w * scale); h = Math.round(h * scale);
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function onAvatarPicked(file) {
  try {
    const dataUrl = await compressImage(file, 320, 0.85);
    state[USERS[me].avatarKey] = dataUrl;
    renderAvatars();
    saveLocal();
    if (!Cloud.ok) { toast('头像已更新 📷'); return; }
    const rev = await Cloud.writeAvatar(me, dataUrl);
    revCache[me] = rev;
    saveLocal();
    toast('头像已更新，对方也能看到啦 📷');
  } catch (e) {
    toast('头像换失败了，再试一次？');
  }
}

/* 换背景：点一下选图，长按恢复默认 */
async function onBgPicked(file) {
  try {
    const dataUrl = await compressImage(file, 900, 0.8);
    state.bg = dataUrl;
    renderBg();
    saveLocal();
    if (!Cloud.ok) { toast('背景已换上 🖼'); return; }
    const rev = await Cloud.writeAvatar('bg', dataUrl);
    revCache.bg = rev;
    saveLocal();
    toast('背景已换上，对方也能看到啦 🖼');
  } catch (e) {
    toast('背景换失败了，再试一次？');
  }
}

async function resetBg() {
  state.bg = '';
  renderBg();
  saveLocal();
  if (!Cloud.ok) { toast('已恢复默认背景'); return; }
  try {
    const rev = await Cloud.writeAvatar('bg', '');
    revCache.bg = rev;
    saveLocal();
    toast('已恢复默认背景');
  } catch (e) { toast('本地已恢复，云端稍后再试'); }
}

/* ============================================================
   事件绑定 & 启动
============================================================ */

function bindUI() {
  // 登录
  document.querySelectorAll('.login-card').forEach((card) => {
    card.addEventListener('click', () => {
      me = card.dataset.user;
      localStorage.setItem('love_me', me);
      showMain();
      toast(USERS[me].name + '，欢迎回家 💕');
    });
  });

  // 切换身份
  $('switch-user').addEventListener('click', () => {
    me = null;
    localStorage.removeItem('love_me');
    showLogin();
  });

  // 四个动作按钮
  document.querySelectorAll('.action-btn').forEach((btn) => {
    btn.addEventListener('click', () => doAction(btn.dataset.action));
  });

  // 纪念日
  $('stat-days').addEventListener('click', openAnniv);
  $('anniv-cancel').addEventListener('click', () => $('anniv-modal').classList.add('hidden'));
  $('anniv-save').addEventListener('click', saveAnniv);

  // 看看你的
  $('peek-close').addEventListener('click', () => $('peek-modal').classList.add('hidden'));

  // 换头像（点自己的头像）
  document.querySelectorAll('.avatar-wrap').forEach((wrap) => {
    wrap.addEventListener('click', () => {
      const user = wrap.closest('.avatar-block').id.replace('block-', '');
      if (user !== me) { toast('只能换自己的头像哦'); return; }
      $('avatar-file').click();
    });
  });
  $('avatar-file').addEventListener('change', (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f && me) onAvatarPicked(f);
  });

  // 换背景：单击选图 / 长按恢复
  const bgBtn = $('bg-btn');
  let pressTimer = null;
  const startPress = () => { pressTimer = setTimeout(() => { pressTimer = null; resetBg(); }, 550); };
  const endPress = () => {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; $('bg-file').click(); }
  };
  bgBtn.addEventListener('touchstart', startPress, { passive: true });
  bgBtn.addEventListener('touchend', (e) => { e.preventDefault(); endPress(); });
  bgBtn.addEventListener('mousedown', startPress);
  bgBtn.addEventListener('mouseup', endPress);
  bgBtn.addEventListener('contextmenu', (e) => e.preventDefault());
  $('bg-file').addEventListener('change', (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) onBgPicked(f);
  });

  // 功能面板入口
  $('feat-gift').addEventListener('click', () => openSheet('sheet-gift'));
  $('feat-achv').addEventListener('click', () => openSheet('sheet-achv'));
  $('feat-idea').addEventListener('click', () => openSheet('sheet-idea'));
  $('feat-time').addEventListener('click', () => openSheet('sheet-time'));
  $('feat-mail').addEventListener('click', () => openSheet('sheet-mail'));
  document.querySelectorAll('.sheet-close').forEach((btn) => {
    btn.addEventListener('click', () => btn.closest('.sheet').classList.add('hidden'));
  });

  // 礼物
  $('gift-cancel').addEventListener('click', () => { giftPending = null; $('gift-confirm').classList.add('hidden'); });
  $('gift-ok').addEventListener('click', buyGift);

  // 约会
  $('idea-draw').addEventListener('click', drawIdea);
  $('idea-redraw').addEventListener('click', drawIdea);
  $('idea-lock').addEventListener('click', lockIdea);
  $('idea-add-btn').addEventListener('click', addIdea);

  // 信箱
  $('letter-back').addEventListener('click', () => {
    $('letter-detail').classList.add('hidden');
    $('letter-list').classList.remove('hidden');
    $('letter-empty').hidden = state.letters.length > 0;
    renderMail();
  });
  $('letter-send').addEventListener('click', sendLetter);

  bindMusic();
}

(function init() {
  buildBackground();
  bindUI();
  loadLocal();
  renderAll();
  if (me) showMain(); else showLogin();

  // 定时同步：连得上 /api 云函数就是云端模式，连不上就本地模式
  setInterval(() => {
    if (document.hidden) return;
    if (!Cloud.available) {
      Cloud.detect().then((ok) => { if (ok) refreshFromCloud(true); });
      return;
    }
    refreshFromCloud(false);
  }, CONFIG.SYNC_INTERVAL);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Cloud.ok) refreshFromCloud(false);
  });

  Cloud.detect().then((ok) => {
    if (ok) refreshFromCloud(true);
    else toastOnce('localmode', '当前是本地模式：部署到 EdgeOne Pages 后，两台手机数据就会自动同步（见使用说明.md）');
  });
})();
