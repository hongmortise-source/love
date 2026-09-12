/* ============================================================
   ♥ 核心逻辑
   ============================================================ */

/* ============================================================
   ♥♥♥ 话术库（想加句子就往对应列表里加，随便加多少条）
   {call} 会自动替换成称呼：洪闻锴说=老婆，刘雨凝说=老公
   heart发送爱心 / hammer锤子 / kiss飞吻 / peek看看你的
   sender·attacker·asker = 主动方的话   receiver·victim·target = 另一方的话
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
};

/* ---------------- 用户与动作定义 ---------------- */

const USERS = {
  liu:  { name: '刘雨凝', call: '老公', avatarKey: 'avatarLiu' },
  hong: { name: '洪闻锴', call: '老婆', avatarKey: 'avatarHong' },
};

const ACTION_LABEL = {
  heart:  '送出了一颗爱心 💖',
  hammer: '锤了你一下 🔨',
  kiss:   '飞吻了一个 😘',
  peek:   '偷偷看了看你 👀',
};

const ROLE = { heart: ['sender', 'receiver'], hammer: ['attacker', 'victim'], kiss: ['sender', 'receiver'], peek: ['asker', 'target'] };

const STAT_LABEL = { intimacy: '亲密值', anger: '怒气值', pervert: '变态值' };

/* ---------------- 状态 ---------------- */

const state = { intimacy: 0, anger: 0, pervert: 0, anniversary: null, avatarLiu: '', avatarHong: '', lastAction: null };
let me = localStorage.getItem('love_me') || null;
let fxBusy = false;
let lastSeenActionTs = 0;

const $ = (id) => document.getElementById(id);
const fxLayer = $('fx-layer');
const partnerOf = (u) => (u === 'liu' ? 'hong' : 'liu');
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const fillCall = (s, user) => s.replace(/\{call\}/g, USERS[user].call);

/* ============================================================
   云端同步（部署到 EdgeOne Pages 后自动启用，走 /api 云函数 + KV）
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

const avatarRevCache = { liu: 0, hong: 0 };   // 头像版本号，变了才重新拉取

/* ---------------- 本地缓存 ---------------- */

function saveLocal() {
  try {
    localStorage.setItem('love_state', JSON.stringify({
      intimacy: state.intimacy, anger: state.anger, pervert: state.pervert,
      anniversary: state.anniversary, avatarLiu: state.avatarLiu, avatarHong: state.avatarHong,
      lastAction: state.lastAction, avatarRevCache,
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
    if (d.avatarRevCache) Object.assign(avatarRevCache, d.avatarRevCache);
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
  let la = st.lastAction;
  if (typeof la === 'string') { try { la = JSON.parse(la); } catch (e) { la = null; } }
  state.lastAction = la || null;

  maybeFetchAvatars(st);

  const ts = (la && la.ts) || 0;
  if (!cloudReady) {
    lastSeenActionTs = ts;   // 首次进入不回放历史动作
    cloudReady = true;
  } else if (la && la.ts > lastSeenActionTs && la.by !== me) {
    lastSeenActionTs = la.ts;
    remoteReplay(la);
  }
  renderAll();
}

/* 头像版本号变了才去云端拉图片 */
async function maybeFetchAvatars(st) {
  const changed = [];
  if ((st.avatarLiuRev || 0) !== avatarRevCache.liu) changed.push('liu');
  if ((st.avatarHongRev || 0) !== avatarRevCache.hong) changed.push('hong');
  for (const who of changed) {
    try {
      const data = await Cloud.getAvatar(who);
      state[who === 'liu' ? 'avatarLiu' : 'avatarHong'] = data || '';
      avatarRevCache[who] = st[who === 'liu' ? 'avatarLiuRev' : 'avatarHongRev'] || 0;
      saveLocal();
      renderAvatars();
    } catch (e) { /* 下次轮询再取 */ }
  }
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
  playEffect(la.type, la.by, true).catch(() => {});
  maybeSpeak(la.type, la.by, 600);
}

/* ---------------- 渲染 ---------------- */

function renderAll() { renderStats(); renderDays(); renderAvatars(); }

function renderStats() {
  $('stat-intimacy').textContent = state.intimacy;
  $('stat-anger').textContent = state.anger;
  $('stat-pervert').textContent = state.pervert;
}

function renderDays() {
  const v = $('days-value'), hint = $('days-hint');
  if (!state.anniversary) { v.textContent = '--'; hint.textContent = '点我设置纪念日'; return; }
  const start = new Date(state.anniversary + 'T00:00:00');
  const days = Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000));
  v.textContent = days;
  hint.textContent = '从 ' + state.anniversary + ' 起';
}

function renderAvatars() {
  const set = (imgId, val, def) => { $(imgId).src = val || def; };
  set('img-liu', state.avatarLiu, CONFIG.DEFAULT_AVATAR.liu);
  set('img-hong', state.avatarHong, CONFIG.DEFAULT_AVATAR.hong);
  set('lc-img-liu', state.avatarLiu, CONFIG.DEFAULT_AVATAR.liu);
  set('lc-img-hong', state.avatarHong, CONFIG.DEFAULT_AVATAR.hong);
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
    const a = el.animate(frames, opts);
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

async function hammerDrop(from, to, actor) {
  const el = spawn('fx-hammer', to.x, to.y - 200, '🔨');
  el.style.left = to.x - 30 + 'px';
  await animate(el, [
    { transform: 'translate(0,-20px) rotate(-100deg)' },
    { transform: 'translate(6px,215px) rotate(-12deg)' },
  ], { duration: 380, easing: 'cubic-bezier(.55,0,1,.45)' });
  // 砸中：爆炸 + 震屏 + 头像缩扁
  const boom = spawn('fx-boom', to.x, to.y, '💥');
  animate(boom, [
    { transform: 'scale(.4)', opacity: 1 },
    { transform: 'scale(1.5)', opacity: 0 },
  ], { duration: 560, easing: 'ease-out' }).then(() => boom.remove());
  document.body.classList.add('shake');
  setTimeout(() => document.body.classList.remove('shake'), 480);
  const av = avatarEl(partnerOf(actor));
  av.classList.remove('squish'); void av.offsetWidth; av.classList.add('squish');
  burst(to, '💔', 4);
  animate(el, [{ transform: 'translate(6px,215px) rotate(-12deg)', opacity: 1 }, { transform: 'translate(6px,215px) rotate(-12deg)', opacity: 0 }], { duration: 260, delay: 120 }).then(() => el.remove());
}

function floatNum(el, text, down) {
  const c = centerOf(el);
  const f = spawn('float-num' + (down ? ' down' : ''), c.x, c.y - 8, text);
  animate(f, [
    { transform: 'translate(0,0)', opacity: 1 },
    { transform: 'translate(0,-48px)', opacity: 0 },
  ], { duration: 1100, easing: 'ease-out' }).then(() => f.remove());
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
    await hammerDrop(src, dst, actor);
  } else if (type === 'peek') {
    await flyEmoji('fx-heart', '👀', src, dst, { lift: 70, dur: 700 });
    if (!silent) openPeek();
  }
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
  const [roleA, roleB] = ROLE[type];
  const trySpeak = (user, role, delay) => {
    setTimeout(() => {
      if (Math.random() < CONFIG.LINE_CHANCE) speak(user, fillCall(pick(LINES[type][role]), user));
    }, delay);
  };
  trySpeak(actor, roleA, baseDelay);
  trySpeak(partnerOf(actor), roleB, baseDelay + 950);
}

/* ============================================================
   动作主流程
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
    const card = k === 'intimacy' ? $('stat-intimacy').closest('.stat-card') : (k === 'anger' ? $('stat-anger').closest('.stat-card') : $('stat-pervert').closest('.stat-card'));
    floatNum(card, (dv > 0 ? '+' : '') + dv + ' ' + STAT_LABEL[k], dv < 0);
  });

  try {
    await playEffect(type, me);
  } catch (e) { /* 特效失败不影响数值 */ }

  maybeSpeak(type, me);

  state.lastAction = { type, by: me, ts: Date.now() };
  lastSeenActionTs = state.lastAction.ts;
  saveLocal();
  syncAction(CONFIG.RULES[type]);

  setTimeout(() => { fxBusy = false; }, 500);
}

async function syncAction(d) {
  if (!Cloud.ok) return;
  try {
    adoptServer(await Cloud.writeState({ inc: d, lastAction: state.lastAction }));
  } catch (e) {
    toast('网络开小差了，数值稍后会补同步');
    setTimeout(() => syncAction(d), 4000);
  }
}

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
   弹窗：纪念日 / 看看你的 / 换头像
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
      adoptServer(await Cloud.writeState({ set: { anniversary: v } }));
      toast('纪念日已保存，对方也看到啦 💘');
    } catch (e) { toast('已保存本地，云端同步失败'); }
  }
  else toast('纪念日已保存 💘');
}

function openPeek() {
  $('peek-title').textContent = '让我看看你的' + pick(CONFIG.PEEK_PARTS) + '…';
  $('peek-sub').textContent = '就一眼，就一眼 👉 变态值 +10';
  $('peek-modal').classList.remove('hidden');
}

/* 头像压缩成 320×320 的 jpeg，省流量也省存储 */
function compressAvatar(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 320;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
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
    const dataUrl = await compressAvatar(file);
    state[USERS[me].avatarKey] = dataUrl;
    renderAvatars();
    saveLocal();
    if (!Cloud.ok) { toast('头像已更新 📷'); return; }
    const rev = await Cloud.writeAvatar(me, dataUrl);
    avatarRevCache[me] = rev;
    saveLocal();
    toast('头像已更新，对方也能看到啦 📷');
  } catch (e) {
    toast('头像换失败了，再试一次？');
  }
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
