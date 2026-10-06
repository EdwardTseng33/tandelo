// data.js — 冒險世界示範資料。全部虛構：隊名、嚮導、對手、數字都是提案值，供高保真 Demo 使用。
// 規則與數字對齊 frontend/adventure.html（概念稿 0.1）與 backend/app/services/world.py。

export const SQUAD = {
  name: '四葉小隊',
  guide: '林老師',
  guild: '林間公會',
  league: '北區',
  subject: '數學',
  route: 'plain',
  week: 3,
  exam: '11/27',
  examLabel: '對準 11/27 段考',
  streak: 4, // 小隊連續有人亮卡的天數（全隊一起算，不做會斷掉的個人連續天數）
  me: { id: 'me', nick: '小睿', av: 1, role: 'scribe', roleBadges: { scout: true, scribe: true } }, // 這週的位置：書記；職業章：嚮導確認做完一次就點亮
  mates: [{ id: 'm2', av: 2 }, { id: 'm3', av: 3 }, { id: 'm4', av: 4 }, { id: 'm5', av: 5 }],
};

export const ROUTES = {
  plain: { name: '平原線', next: 'hills', note: '開季一律從這裡出發' },
  hills: { name: '丘陵線', next: 'ridge', note: '副本 75% 以上就往上一條' },
  ridge: { name: '山徑線', next: 'cloud', note: '題目換成更綜合的變化' },
  cloud: { name: '雲頂線', next: null, note: '混入跨章節的怪' },
};

export const ROLES = {
  scout: { name: '先鋒', short: '鋒', does: '週三第一個去試下一隻怪，回報卡在哪一步。' },
  striker: { name: '主攻', short: '攻', does: '合擊那一幕先開口講那一步。' },
  scribe: { name: '書記', short: '書', does: '把每個人的「我搞懂的」整理成一句，送進冒險日誌。' },
  quartermaster: { name: '整備官', short: '備', does: '看整備條，可以對全隊按一次「大家加油」。' },
};

// 四大陸：數理大陸可玩；其他三個依題庫達標順序開（英文、社會、國文），地圖先以迷霧呈現，怪先露臉。
export const CONTINENTS = [
  { id: 'math', name: '數理大陸', subject: '數學', open: true, map: 'map-math' },
  { id: 'en', name: '西風港', subject: '英文', open: false, map: 'map-en',
    spots: [{ id: 'dock', name: '碼頭區', x: 170, y: 190 }, { id: 'mill', name: '風車坡', x: 312, y: 150 }, { id: 'cape', name: '南岬', x: 250, y: 330 }],
    monsters: [{ id: 'en-tense', name: '時光獸', shape: 'm2-clock', skill: '時態' }, { id: 'en-s', name: '失蹤的 s', shape: 'm2-snake', skill: '第三人稱單數' }, { id: 'en-prep', name: '介係詞迷路怪', shape: 'm2-arrow', skill: '介係詞' }] },
  { id: 'soc', name: '時光古道', subject: '社會', open: false, map: 'map-soc',
    spots: [{ id: 'gate', name: '石門', x: 124, y: 150 }, { id: 'road', name: '古道口', x: 300, y: 214 }, { id: 'rings', name: '年輪台', x: 150, y: 330 }],
    monsters: [{ id: 'soc-era', name: '年代錯置怪', shape: 'm2-hourglass', skill: '年代順序' }, { id: 'soc-cause', name: '因果顛倒獸', shape: 'm2-flip', skill: '因果關係' }, { id: 'soc-geo', name: '經緯迷航', shape: 'm2-compass', skill: '經緯與方位' }] },
  { id: 'zh', name: '字林', subject: '國文', open: false, map: 'map-zh',
    spots: [{ id: 'bamboo', name: '竹徑', x: 124, y: 290 }, { id: 'hall', name: '書院', x: 258, y: 300 }, { id: 'deep', name: '林深處', x: 230, y: 150 }],
    monsters: [{ id: 'zh-homo', name: '音近字妖', shape: 'm2-twin', skill: '音近字' }, { id: 'zh-wenyan', name: '之乎迷霧', shape: 'm2-mist', skill: '文言虛字' }, { id: 'zh-rhet', name: '修辭變臉怪', shape: 'm2-mask', skill: '修辭' }] },
];

export const REGIONS = [
  { id: 'mult', name: '乘法平原', continent: 'math', light: 'lit', keeper: 'us', progress: [3600, 3000], x: 161, y: 190 },
  { id: 'poly', name: '多項式林', continent: 'math', light: 'lit', keeper: 'other', progress: [3120, 3000], x: 266, y: 165 },
  { id: 'sqrt', name: '根號谷', continent: 'math', light: 'lit', keeper: 'us', progress: [3240, 3000], x: 351, y: 230 },
  { id: 'pyth', name: '畢氏山', continent: 'math', light: 'unlit', keeper: null, progress: [1860, 3000], x: 141, y: 315 },
  { id: 'factor', name: '分解洞窟', continent: 'math', light: 'unlit', keeper: null, progress: [940, 3000], x: 251, y: 345 },
  { id: 'quad', name: '二次高原', continent: 'math', light: 'fog', keeper: null, progress: [0, 3000], x: 330, y: 350 },
];

// 怪：id 對應原型與後端的卡點 id。五欄傳說卡：出身、騙術、口頭禪、弱點、被識破時。
export const MONSTERS = [
  {
    id: 'sq-expand', name: '漏項獸', region: 'mult', shape: 'm-round', skill: '完全平方要有中間那一項',
    does: '把 (a+b)² 中間那兩塊偷走，讓你以為只剩 a² + b²。',
    origin: '住在乘法平原最平的那一塊。很多人第一次看到 (a+b)²，眼睛只看到兩個平方，牠就從那個習慣裡長出來。',
    trick: '讓你以為 (a+b)² 只剩 a² 和 b²，中間那兩塊長方形被牠偷走。',
    taunt: '兩個平方，就這樣，沒別的了。',
    weakness: '一塊邊長 a+b 的正方形，中間一定多出兩塊 ab。',
    caught: '……那兩塊你也看到了喔。',
  },
  {
    id: 'sign-dist', name: '負號幽靈', region: 'poly', shape: 'm-cloud', skill: '減去括號，每一項都要變號',
    does: '躲在括號前面，只讓第一項變號，後面的都放過。',
    origin: '住在括號前面。很多人第一次學減法時，只把負號給了第一個數，牠就從那個習慣裡長出來。',
    trick: '讓你以為負號只碰括號裡的第一項，後面的都放過。',
    taunt: '第一個歸我，後面的我不管。',
    weakness: '負號要發給括號裡每一個人。',
    caught: '連第三項都被你看到了……',
  },
  {
    id: 'sqrt-split', name: '拆根蟲', region: 'sqrt', shape: 'm-bug', skill: '根號裡面要先算完',
    does: '把 √(25 − 9) 咬成 √25 − √9。',
    origin: '根號谷的石縫裡。牠見過太多人把根號當成普通的括號，以為可以分開來算。',
    trick: '讓你把根號裡的加減拆成兩個根號。',
    taunt: '分開算比較快，相信我。',
    weakness: '根號裡面要先算完，再開根號。',
    caught: '你居然先算裡面的……',
  },
  {
    id: 'sqrt-sign', name: '雙面根', region: 'sqrt', shape: 'm-twin', skill: '√ 開出來一定不是負的',
    does: '讓你以為 √(a²) 可以是負的。',
    origin: '根號谷的湖面上，一張臉兩個倒影。平方有兩個根，牠就讓你以為根號也有兩個答案。',
    trick: '讓你把 √(a²) 寫成 ±a。',
    taunt: '正的負的都可以，隨便你挑。',
    weakness: '√ 的結果一定不是負的，√(a²) = |a|。',
    caught: '你只選了一邊……',
  },
  {
    id: 'pyth-hyp', name: '斜邊迷霧', region: 'pyth', shape: 'm-tri', skill: '先認出哪一邊是斜邊',
    does: '把三角形轉個方向，你就認錯哪一邊是斜邊。',
    origin: '課本裡的直角三角形總是直角在左下、斜邊在右上。牠就躲在那個習慣裡，只要三角形一轉，你就認錯邊。',
    trick: '把三角形轉個方向，讓你把最長的邊當成股。',
    taunt: '右上那條就是斜邊，看都不用看。',
    weakness: '斜邊永遠對著直角，先找直角再找斜邊。',
    caught: '你居然先找直角……',
  },
  {
    id: 'diff-sq', name: '平方差雙子', region: 'factor', shape: 'm-drop', skill: '平方差：一個加、一個減',
    does: '一個加、一個減，牠讓你兩個都寫減。',
    origin: '分解洞窟裡的一對雙胞胎。牠們長得一模一樣，所以你以為兩個括號也要一模一樣。',
    trick: '讓你把 a² − b² 寫成 (a − b)(a − b)。',
    taunt: '我們是雙胞胎，當然一樣。',
    weakness: '平方差分解出來一個加、一個減。',
    caught: '你分得出我們兩個了……',
  },
  {
    id: 'factor-cross', name: '十字符號怪', region: 'factor', shape: 'm-cross', skill: '十字交乘要顧到符號',
    does: '十字交乘到最後一步，偷偷把符號換掉。',
    origin: '分解洞窟最深處。牠等你把數字都配對好、鬆一口氣的那一秒，才出手。',
    trick: '讓你在最後一步寫錯正負號。',
    taunt: '數字對了就好，符號誰在看。',
    weakness: '配好數字之後，把符號乘回去驗算一次。',
    caught: '你連符號都驗算了……',
  },
  {
    id: 'zero-hide', name: '零的隱者', region: 'quad', shape: 'm-ring', skill: '不能隨便兩邊除以 x',
    does: '你兩邊除以 x 的那一刻，牠把 x = 0 藏走。',
    origin: '二次高原的風裡。牠不說話，只在你除以 x 的時候，把一個答案悄悄收進口袋。',
    trick: '讓你兩邊除以 x，丟掉 x = 0 這個解。',
    taunt: '……',
    weakness: '移項提出公因式，x 本身也可能是 0。',
    caught: '你找到我藏的那個零了。',
  },
];

// 我的夥伴狀態：fog 迷霧 / near 還在附近 / hit 打中了 / captured 收服 / asleep 睡著了
export const INITIAL_SHADOWS = {
  'sq-expand': { state: 'captured', day0: '10/02', dayN: '10/11', days: 9 },
  'sign-dist': { state: 'near', note: '這週的怪 · 今晚補刀' },
  'sqrt-split': { state: 'hit', due: '週一', note: '牠會回來，沒有提示' },
  'sqrt-sign': { state: 'captured', day0: '09/25', dayN: '10/04', days: 9 },
  'pyth-hyp': { state: 'fog', note: '下週遠征偵察' },
  'diff-sq': { state: 'asleep', note: '上週又錯了一次，今天可以叫醒' },
  'factor-cross': { state: 'fog' },
  'zero-hide': { state: 'fog' },
};

export const STATE_LABEL = {
  fog: '迷霧', near: '還在附近', hit: '打中了', captured: '收服', asleep: '睡著了',
};

export const TITLES = [
  { id: 'first', name: '初次拓荒', rule: '第一次收服', earned: true },
  { id: 'keeper', name: '守住的人', rule: '叫醒三隻睡著的夥伴', earned: false, progress: [1, 3] },
  { id: 'explainer', name: '講解者', rule: '主攻被嚮導蓋章三次', earned: false, progress: [1, 3] },
  { id: 'flag', name: '開拓者之旗', rule: '全隊一起收服 20 隻', team: true, earned: false, progress: [11, 20] },
];

// 戰績：只從驗證過的學會來。數字為提案。
export const POINTS = { capture: 10, wake: 5, explain: 3, dungeon1: 5, dungeon2: 8, dungeon3: 12 };

// 隊友動態：首頁「隊友剛剛」一條一條冒出來，讓小隊像是活著的（示範資料，匿名只顯示色塊與暱稱）。
export const TEAM_FEED = [
  { id: 'f1', av: 3, who: '阿哲', text: '打中了負號幽靈，第 2 題', kind: 'hit' },
  { id: 'f2', av: 2, who: '小琪', text: '錄了 30 秒講解，給卡住的隊友', kind: 'explain' },
  { id: 'f3', av: 5, who: '阿寶', text: '第 3 棒交出去了', kind: 'relay' },
  { id: 'f4', av: 4, who: '芸芸', text: '叫醒了漏項獸', kind: 'wake' },
  { id: 'f5', av: 3, who: '阿哲', text: '3 連擊', kind: 'combo' },
  { id: 'f6', av: 2, who: '小琪', text: '今天三張都亮了', kind: 'card' },
];

// 嚮導視角：人力只在三個時刻介入。系統推過、巡查沒回，才輪到嚮導；每一次都記分鐘數。
export const GUIDE_QUEUE = [
  { id: 'g1', trigger: 'help_timeout', who: '一位隊友', text: '卡在負號幽靈，求援 32 分鐘沒人回', ladder: '系統推過 2 次 · 巡查沒回', kind: 'explain', minutes: 1, action: '錄 30 秒', mon: 'sign-dist' },
  { id: 'g2', trigger: 'three_wrong', who: '阿哲', text: '三次踩「負號只給第一項」', ladder: '系統提示過 3 次', kind: 'nudge', minutes: 0.5, action: '推一句', mon: 'sign-dist', lines: ['括號前面的負號，要發給裡面每一個。', '把 −(2x − 3) 先寫成 −2x + 3 再合併。', '你第二題已經對了，用同一招。'] },
  { id: 'g3', trigger: 'three_days_off', who: '芸芸', text: '三天沒亮任務卡', ladder: '系統沒推播（關燈規則）', kind: 'comfort', minutes: 1, action: '問候', mon: 'diff-sq', lines: ['這週的怪比較難，先回來打一題就好。', '隊友在等你的那一棒。', '明天 20:30 我在營地。'] },
];
export const GUIDE_WEEK = { minutesSoFar: 23, students: 5, cap: 6 }; // 本週已用人力分鐘（示範）、隊員數、每生每週上限

export const RECORD_EVENTS = [
  { kind: 'capture', label: '收服 雙面根', pts: 10, when: '10/04' },
  { kind: 'capture', label: '收服 漏項獸', pts: 10, when: '10/11' },
  { kind: 'wake', label: '叫醒 拆根蟲', pts: 5, when: '10/06' },
  { kind: 'explain', label: '講解抽查合格', pts: 3, when: '10/09' },
  { kind: 'dungeon2', label: '副本兩星（全隊一份）', pts: 8, when: '10/07' },
];

// 這週的副本：多項式林深處 · 平原線
export const DUNGEON = {
  name: '多項式林深處',
  monster: 'sign-dist',
  route: 'plain',
  opened: '週五 20:00',
  settle: '週二 22:00',
  relayDeadline: '週二 21:30',
  size: 5,
};

// 巡邏層：負號幽靈的三個變體。trap 是牠的錯法（答到會觸發台詞）。
export const PATROL = [
  {
    id: 'p1', stem: '化簡：(3x + 2) − (x − 5)',
    options: ['2x + 7', '2x − 3', '4x − 3', '2x − 7'], answer: 0, trap: 1,
    steps: ['先把括號拆開', '負號要發給 x 和 −5 兩個人', '合併同類項'],
    hint: { ask: '你寫到哪一步？', point: '拆開括號的時候，負號發給了幾個人？', lend: '試試看：5 − (2 − 1) 是 4，不是 2。括號裡兩個都要變號。', show: '− (x − 5) 拆開是 −x + 5。接下來你合併看看。' },
  },
  {
    id: 'p2', stem: '化簡：5a − (2a − 3b + 1)',
    options: ['3a + 3b − 1', '3a − 3b + 1', '3a − 3b − 1', '7a − 3b − 1'], answer: 0, trap: 1,
    steps: ['拆開括號', '三項都變號：−2a + 3b − 1', '合併：3a + 3b − 1'],
    hint: { ask: '你寫到哪一步？', point: '括號裡有三個人，負號發到第幾個就停了？', lend: '像發糖果：括號前面的負號，括號裡每一個都要拿到。', show: '− (2a − 3b + 1) 拆開是 −2a + 3b − 1。剩下的你來。' },
    why: true,
  },
  {
    id: 'p3', stem: '化簡：(x² − 4x) − (−2x² + x − 6)',
    options: ['3x² − 5x + 6', '−x² − 3x − 6', '3x² − 3x − 6', '3x² − 5x − 6'], answer: 0, trap: 3,
    steps: ['拆開第二個括號', '每一項變號：+2x² − x + 6', '合併：3x² − 5x + 6'],
    hint: { ask: '你寫到哪一步？', point: '最後那個 −6，變號之後是正的還是負的？', lend: '負負得正：−(−6) 是 +6。', show: '−(−2x² + x − 6) 是 +2x² − x + 6。你把它和前面合併。' },
  },
];

// Boss 接力：一題多步驟，棒次由系統排。前面的棒由隊友完成（只顯示色塊，不顯示名字）。
export const RELAY = {
  stem: '化簡 2(x + 3)² − (x − 1)(x + 1)，再求 x = 2 時的值。',
  steps: [
    { by: 2, text: '(x + 3)² = x² + 6x + 9', done: true },
    { by: 3, text: '2(x² + 6x + 9) = 2x² + 12x + 18', done: true },
    { by: 5, text: '(x − 1)(x + 1) = x² − 1', done: true },
    { by: 'me', text: '2x² + 12x + 18 − (x² − 1) = ?', done: false,
      options: ['x² + 12x + 19', 'x² + 12x + 17', 'x² + 12x + 18', '3x² + 12x + 17'], answer: 0, trap: 1 },
    { by: 4, text: '代入 x = 2', done: false },
  ],
  flags: 2,
};

// 伏擊層：到期的夥伴回來。沒有提示、不能求援、只認第一次。
export const AMBUSH = {
  monster: 'sqrt-split',
  stem: '√(169 − 25) = ?',
  options: ['12', '8', '144', '10'], answer: 0, trap: 1,
  due: '週一',
};

// 出題戰（第 3 週）：星期三小隊出了三題。
export const DUEL = {
  opponent: '星期三小隊',
  week: 3,
  reveal: '下次遠征揭曉',
  questions: [
    { n: 1, monster: 'sq-expand', stem: '(x + 4)² = ?', candidates: [{ t: 'x² + 8x + 16', v: 4 }, { t: 'x² + 16', v: 0 }], voted: true },
    { n: 2, monster: 'diff-sq', stem: '9x² − 4 = ?', candidates: [{ t: '(3x + 2)(3x − 2)', v: 3 }, { t: '(9x − 2)(x + 2)', v: 1 }], voted: false },
    { n: 3, monster: 'sqrt-split', stem: '√(100 − 36) = ?', candidates: [{ t: '8', v: 2 }, { t: '4', v: 2 }], voted: false },
  ],
  ours: { picked: ['sq-expand', 'sqrt-split', 'sign-dist'], status: '內容團隊已篩過 · 等林老師點頭' },
  history: [
    { week: 1, kind: 'ghost', label: '幽靈隊', result: '鏡像賽 · 平手' },
  ],
};

// 燈塔頁：北區 · 根號谷。榜只顯示前後各三隊，不顯示名次。
export const TOWER = {
  region: 'sqrt',
  words: '根號裡面要先算完，拆根蟲最愛騙你先開根號。',
  wordsBy: '四葉小隊',
  layer: 'plain',
  until: '10/31',
  board: [
    { name: '北風小隊', av: 6, pts: 244 },
    { name: '石頭湯小隊', av: 3, pts: 231 },
    { name: '星期三小隊', av: 4, pts: 212, dir: 'up' },
    { name: '四葉小隊', av: 1, pts: 196, mine: true },
    { name: '夜行小隊', av: 5, pts: 171, dir: 'down' },
    { name: '橘子皮小隊', av: 2, pts: 158 },
    { name: '小火車小隊', av: 6, pts: 140 },
  ],
  hall: [
    { month: '9 月', layer: '平原線', name: '夜行小隊' },
    { month: '9 月', layer: '丘陵線', name: '北風小隊' },
  ],
};

export const GUILD = {
  name: '林間公會',
  master: '林老師',
  squads: 4,
  members: 19,
  perCapita: 58,
  perCapitaGoal: 60,
  squadTotal: 236,
  unlocks: [
    { name: '隊旗圖樣', at: 100, who: 'squad' },
    { name: '地圖配色', at: 150, who: 'squad' },
    { name: '夥伴外框', at: 200, who: 'squad' },
    { name: '季末合照框', at: 300, who: 'squad' },
    { name: '魔王攻略會 · 段考前加開 30 分鐘', at: 60, who: 'guild' },
  ],
  wall: [
    { who: '四葉小隊', av: 1, text: '這週一起收服了 3 次。', when: '今天' },
    { who: '星期三小隊', av: 4, text: '打了一場對戰。', when: '昨天' },
    { who: '夜行小隊', av: 5, text: '拿到一枚好題印記。', when: '週四' },
    { who: '林老師', av: 0, text: '留了一則語音：「這週的怪在括號前面，大家先別急著算。」', when: '週三', voice: true },
  ],
  race: {
    month: '10 月', theme: '根號谷之月', when: '10/31（六）09:00 – 11/1（日）20:00',
    rule: '解題率 80% 以上，而且沒申報缺席的人全員出手。', prize: '每位隊員各一枚根號谷徽章吊飾，寄給家長。',
    server: [2180, 3000],
    signed: false,
  },
  album: [
    { month: '9 月', theme: '乘法平原之月', got: true },
    { month: '10 月', theme: '根號谷之月', got: false, now: true },
    { month: '11 月', theme: '畢氏山之月' }, { month: '12 月', theme: '分解洞窟之月' },
    { month: '1 月' }, { month: '2 月' }, { month: '3 月' }, { month: '4 月' }, { month: '5 月' }, { month: '6 月' },
  ],
};

// 嚮導的信：一季八封，第 3 週「遭遇」。
export const LETTER = {
  week: 3, chapter: '遭遇', length: '0:58',
  panels: [
    { mon: 'sign-dist', state: 'fog', title: '多項式林深處', text: '迷霧比上週更濃。你們上週打中的拆根蟲，這週會回來一次。' },
    { mon: 'sign-dist', state: 'near', title: '今天的怪', text: '負號幽靈。牠只有一句話：「第一個歸我，後面的我不管。」' },
    { mon: 'sq-expand', state: 'shadow', title: '對面的小隊', text: '星期三小隊也在追同一隻怪。這週你們互相出題，下次遠征揭曉。' },
  ],
};

// 家長端：營地來信（LINE）。
// 營地來信：家長端不用遊戲語言（不說「收服、怪、戰績」），只說學會了什麼、還在練什麼、今晚可以問他哪一句。
export const CAMP = {
  time: '星期二 21:02',
  from: 'Tandelo 營地 · 林老師的四葉小隊',
  text: '小睿這週學會了：(a + b)² 展開時，中間要有 2ab 這一項。隔了 9 天、不給提示也做對了。',
  chase: '還在練：括號前面是減號時，括號裡每一項都要變號。週四的小隊課，林老師會帶全隊再練一次。',
  ask: '今晚可以問他：「一塊邊長是 a+b 的正方形，為什麼比 a² + b² 多出兩塊長方形？」',
  answer: '他可能會這樣說：「切開來有 a²、b²，還有兩塊 a × b 的長方形，所以多出 2ab。」',
  witnessed: true,
};

// 家長端「這是誰寄的？」：嚮導是誰、誰會跟孩子互動、資料去哪（示範文案；正式條款上線前由法務與隱私審過）
export const CAMP_ABOUT = [
  ['寄件人', 'Tandelo 營地。每週由孩子的嚮導林老師看過孩子的紀錄後寄出，只寄到綁定的家長 LINE。'],
  ['嚮導', '林老師，國中數學老師。每週帶一次小隊課，只在孩子卡住太久、同一個錯連錯三次、三天沒來時介入。'],
  ['誰會跟孩子互動', '同隊 3 到 5 位國中生，只看得到暱稱和插畫角色，看不到真名、學校、照片；孩子之間沒有私訊、不能自由打字聊天。'],
  ['孩子的聲音', '「說一句為什麼」的錄音只給嚮導聽；講給隊友聽是孩子自己按送出才會給同隊。不想說話可以改用打字。'],
  ['資料', '只存暱稱、年級、段考日期與學習紀錄。家長可以隨時在 LINE 暫停或刪除帳號；實體徽章的收件資料寄出後 30 天刪除。'],
];
export const JOIN_QR = { vb: '0 0 29 29', d: 'M0 0.5h7m4 0h1m4 0h1m1 0h3m1 0h7M0 1.5h1m5 0h1m1 0h2m4 0h2m1 0h1m4 0h1m5 0h1M0 2.5h1m1 0h3m1 0h1m2 0h3m2 0h3m2 0h2m1 0h1m1 0h3m1 0h1M0 3.5h1m1 0h3m1 0h1m1 0h1m1 0h6m1 0h1m1 0h1m2 0h1m1 0h3m1 0h1M0 4.5h1m1 0h3m1 0h1m4 0h1m1 0h1m2 0h4m2 0h1m1 0h3m1 0h1M0 5.5h1m5 0h1m1 0h1m1 0h1m1 0h1m1 0h2m2 0h1m1 0h1m1 0h1m5 0h1M0 6.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M9 7.5h1m1 0h2m3 0h1m2 0h1M0 8.5h5m1 0h4m1 0h4m2 0h1m2 0h2m1 0h1m1 0h1m1 0h1M0 9.5h1m1 0h1m2 0h1m2 0h1m2 0h1m1 0h1m2 0h1m2 0h1m2 0h3m3 0h1M0 10.5h1m1 0h5m1 0h1m1 0h1m2 0h4m3 0h2m1 0h2M0 11.5h4m1 0h1m2 0h1m2 0h1m2 0h2m2 0h2m1 0h2m1 0h2m1 0h1M5 12.5h2m1 0h6m1 0h1m1 0h1m2 0h1m4 0h2M0 13.5h1m2 0h3m2 0h2m1 0h3m2 0h4m1 0h4m3 0h1M2 14.5h1m1 0h1m1 0h1m1 0h1m4 0h3m2 0h1m1 0h1m2 0h1m1 0h2M0 15.5h1m2 0h1m1 0h1m2 0h5m1 0h3m1 0h4m1 0h2m2 0h1M0 16.5h1m1 0h1m1 0h3m1 0h2m2 0h6m5 0h1m1 0h2M0 17.5h2m1 0h3m2 0h2m1 0h2m1 0h1m1 0h1m2 0h2m1 0h3m1 0h1m1 0h1M0 18.5h1m1 0h1m3 0h1m1 0h1m1 0h1m2 0h4m7 0h1m1 0h1M0 19.5h1m1 0h2m3 0h1m3 0h1m2 0h1m1 0h1m2 0h3m1 0h2m2 0h1M0 20.5h1m1 0h1m2 0h3m1 0h6m2 0h1m1 0h6m1 0h3M8 21.5h2m1 0h3m4 0h1m1 0h1m3 0h5M0 22.5h7m1 0h1m1 0h1m1 0h9m1 0h1m1 0h3M0 23.5h1m5 0h1m7 0h1m1 0h1m1 0h3m3 0h1m2 0h1M0 24.5h1m1 0h3m1 0h1m1 0h3m1 0h3m2 0h2m1 0h5m1 0h1M0 25.5h1m1 0h3m1 0h1m1 0h2m1 0h1m2 0h1m1 0h4m5 0h2m1 0h1M0 26.5h1m1 0h3m1 0h1m1 0h1m3 0h2m1 0h3m1 0h1m2 0h6M0 27.5h1m5 0h1m1 0h3m4 0h1m2 0h1m1 0h2m1 0h3m1 0h1M0 28.5h7m1 0h2m1 0h4m2 0h1m1 0h1m2 0h3m1 0h1' };

// 示範時鐘：四個常用時間點。
export const CLOCKS = [
  { id: 'sat', label: '週六 20:38', day: '週六', time: '20:38', note: '巡邏與接力開跑' },
  { id: 'mon', label: '週一 19:10', day: '週一', time: '19:10', note: '伏擊層開放' },
  { id: 'tue', label: '週二 22:00', day: '週二', time: '22:00', note: '副本結算' },
  { id: 'night', label: '週二 22:40', day: '週二', time: '22:40', note: '關燈中' },
];

// 數理大陸地形（由 assets/illustrations/_src/worldmap.py 產生）
export const MAP_TERRAIN = `<path class="wave" d="M26 40q10-6 20 0t20 0M372 70q10-6 20 0t20 0M46 392q10-6 20 0t20 0M352 372q10-6 20 0t20 0M400 330q10-6 20 0t20 0"/><path class="land" d="M76 128c14-44 60-74 118-82 46-6 96 4 134 34 36 28 60 70 52 118-6 36-32 62-60 86-30 26-66 44-108 44-44 0-84-20-110-50-26-32-40-80-26-150z"/><path class="shore" d="M94 150c10-30 44-56 90-64" /><path class="shore" d="M330 100c22 20 38 48 38 80"/><path class="field" d="M112 182h66M106 196h74M112 210h66M118 224h56"/><path class="tree" d="M236 122l-6 10h4v4h4v-4h4z"/><path class="tree" d="M256 116l-6 10h4v4h4v-4h4z"/><path class="tree" d="M276 126l-6 10h4v4h4v-4h4z"/><path class="tree" d="M246 142l-6 10h4v4h4v-4h4z"/><path class="tree" d="M268 146l-6 10h4v4h4v-4h4z"/><path class="tree" d="M290 140l-6 10h4v4h4v-4h4z"/><path class="tree" d="M228 150l-6 10h4v4h4v-4h4z"/><path class="tree" d="M302 158l-6 10h4v4h4v-4h4z"/><path class="valley" d="M318 206l20 36 22-40"/><path class="river" d="M338 242q6 18-4 34t2 34"/><path class="peak" d="M126 284l-14 22h28z"/><path class="snow" d="M126 284l-5 8h10z"/><path class="peak" d="M154 270l-14 22h28z"/><path class="snow" d="M154 270l-5 8h10z"/><path class="peak" d="M176 296l-14 22h28z"/><path class="snow" d="M176 296l-5 8h10z"/><path class="cave" d="M232 356a22 18 0 0 1 44 0z"/><path class="cave-in" d="M242 356a12 10 0 0 1 24 0z"/><path class="mesa" d="M296 318l14-14h40l14 14z"/><path class="mesa-top" d="M310 304h40"/><path class="route" d="M60 60q60-30 120-10M400 390q-40 20-90 6"/>`;
