/* ============================================================
   ♥ 配置文件：想调什么就改这里，改完刷新页面即可生效
   ============================================================ */

const CONFIG = {

  /* ---------- 云端同步 ----------
     不用填任何东西！用「GitHub 仓库导入」方式部署到 EdgeOne Pages 后
     （见《使用说明.md》），同步自动开启，无需开通任何存储服务。
     本地直接打开网页时自动退回"本地模式"。 */
  SYNC_PASSCODE: '',   // 可选：填一串只有你们俩知道的字符，防止陌生人乱改数据。
                       // 注意：functions/api/state.js 和 avatar.js 顶部的 PASSCODE 要改成一样

  /* ---------- 背景音乐 ----------
     换歌：下载 mp3 后直接覆盖 assets/music.mp3 即可，不用改代码。
     想放多首歌：往列表里加，例如 { title: '告白气球', url: 'assets/music2.mp3' }
     （出现第二首后，音乐按钮旁会出现切歌按钮） */
  MUSIC_LIST: [
  { title: '我们俩', url: 'assets/music.mp3' },
  { title: '离开我的依赖', url: 'assets/music2.mp3' }, 
  { title: '告白气球', url: 'assets/music3.mp3' },   // ← 新增的
],

  /* ---------- 数值规则 ----------
     每次操作各数值的变化（可为负，最低减到 0） */
  RULES: {
    heart:  { intimacy: +1, anger: -5 },              // 发送爱心
    hammer: { intimacy: -1, anger: +1 },              // 锤子打对方
    kiss:   { intimacy: +5, pervert: +1 },            // 飞吻
    peek:   { pervert: +10 },                         // 看看你的
  },

  /* 说话概率：0.5 = 每次操作后，每个人的头像各有 50% 概率冒出气泡说话 */
  LINE_CHANCE: 0.5,

  /* ---------- "看看你的"会随机抽的身体部位 ---------- */
  PEEK_PARTS: ['锁骨', '耳朵', '腹肌', '侧脸', '手指', '后颈', '眼睛', '肩膀', '手腕', '下巴'],

  /* ---------- 默认头像（替换 assets 里的两张图即可换头像） ---------- */
  DEFAULT_AVATAR: {
    liu:  'assets/avatar-liu.jpg',    // 刘雨凝
    hong: 'assets/avatar-hong.jpg',   // 洪闻锴
  },

  /* ---------- 礼物小铺（花亲密值购买，价格自己改） ---------- */
  GIFTS: [
    { id: 'star',    emoji: '⭐', name: '小星星',   price: 5 },
    { id: 'rose',    emoji: '🌹', name: '玫瑰花',   price: 10 },
    { id: 'choc',    emoji: '🍫', name: '巧克力',   price: 20 },
    { id: 'milktea', emoji: '🧋', name: '奶茶',     price: 30 },
    { id: 'cat',     emoji: '🐱', name: '小猫咪',   price: 66 },
    { id: 'bear',    emoji: '🧸', name: '小熊',     price: 88 },
    { id: 'ring',    emoji: '💍', name: '戒指',     price: 520 },
    { id: 'crown',   emoji: '👑', name: '皇冠',     price: 999 },
  ],

  /* ---------- 约会提案的点子库（也可以在页面里自己加） ---------- */
  DATE_IDEAS: [
    '一起去看日落', '去吃那家一直想吃的火锅', '窝在家看一部电影',
    '去游乐园疯一天', '一起做一顿饭', '夜市小吃巡游',
    '去猫咖撸猫', '打游戏打到半夜', '去江边或湖边散步',
    '拍一组情侣写真', '一起去逛超市买菜', '说走就走的短途旅行',
  ],

  /* ---------- 成就徽章（type 对应动作计数 / intimacy 亲密值 / days 相爱天数） ---------- */
  ACHIEVEMENTS: [
    { id: 'heart1',    icon: '💖', name: '爱的初体验', desc: '送出第 1 颗爱心',   type: 'heart',    n: 1 },
    { id: 'heart100',  icon: '💘', name: '爱心轰炸机', desc: '累计送出 100 颗爱心', type: 'heart',  n: 100 },
    { id: 'heart500',  icon: '🌹', name: '爱意满溢',   desc: '累计送出 500 颗爱心', type: 'heart',  n: 500 },
    { id: 'hammer1',   icon: '🔨', name: '欢喜冤家',   desc: '第一次锤 TA',        type: 'hammer',   n: 1 },
    { id: 'hammer100', icon: '💥', name: '锤锤相恋',   desc: '累计锤了 100 次',    type: 'hammer', n: 100 },
    { id: 'kiss50',    icon: '😘', name: '吻神',       desc: '累计飞吻 50 次',     type: 'kiss',     n: 50 },
    { id: 'peek20',    icon: '👀', name: '变态观察员', desc: '偷偷看了 20 次',     type: 'peek',     n: 20 },
    { id: 'gift1',     icon: '🎁', name: '礼尚往来',   desc: '送出第 1 份礼物',    type: 'gift',     n: 1 },
    { id: 'gift20',    icon: '🏆', name: '豪礼满堂',   desc: '累计送出 20 份礼物', type: 'gift',    n: 20 },
    { id: 'letter1',   icon: '✉️', name: '见字如面',   desc: '写出第 1 封信',      type: 'letter',   n: 1 },
    { id: 'letter20',  icon: '💌', name: '情书高手',   desc: '累计写了 20 封信',   type: 'letter',  n: 20 },
    { id: 'int100',    icon: '💕', name: '甜度超标',   desc: '亲密值达到 100',     type: 'intimacy', n: 100 },
    { id: 'int520',    icon: '💞', name: '亲亲蜜蜜',   desc: '亲密值达到 520',     type: 'intimacy', n: 520 },
    { id: 'int1314',   icon: '❤️', name: '一生一世',   desc: '亲密值达到 1314',    type: 'intimacy', n: 1314 },
    { id: 'days100',   icon: '💯', name: '百日恩恋',   desc: '相爱满 100 天',      type: 'days',     n: 100 },
    { id: 'days365',   icon: '🎓', name: '一年之约',   desc: '相爱满 365 天',      type: 'days',     n: 365 },
  ],

  /* 两台手机数据同步的间隔（毫秒），3000~10000 都行 */
  SYNC_INTERVAL: 5000,
};
