// content.js — 題庫、卡點地圖、課表、小隊與老師的示範資料（全部虛構）
// 純資料＋純函式：不碰 DOM、不碰 localStorage，可直接用 node 測試。

export const CHAPTERS = [
  { id: 'mult', name: '乘法公式' },
  { id: 'poly', name: '多項式' },
  { id: 'sqrt', name: '平方根' },
  { id: 'pyth', name: '畢氏定理' },
  { id: 'factor', name: '因式分解' },
  { id: 'quad', name: '一元二次方程式' },
];

export const SKILL_ORDER = [
  'sq-cross', 'sign-dist', 'sqrt-split', 'sqrt-abs',
  'pyth-hyp', 'factor-diff', 'factor-cross', 'quad-zero',
];

// 每個卡點＝「卡在哪一步」，不是整章。
// 數學式用 ASCII 的 - 撰寫，畫面上會轉成 −。
export const SKILLS = {
  'sq-cross': {
    chapter: 'mult',
    title: '完全平方要有中間那一項',
    short: '漏掉中間項',
    why: '把 (a+b)² 當成 a² + b²，忘了 a 和 b 互相乘出來的那兩塊。',
    tonight: '今晚可以問他：「一塊邊長是 a+b 的正方形，為什麼比 a² + b² 多出兩塊長方形？」',
    warm: { q: '(3 + 4)² 和 3² + 4² 一樣嗎？', opts: ['一樣', '不一樣'], ok: 1 },
    board: { wrong: '(x + 3)² = x² + 9', right: '(x + 3)² = x² + 6x + 9', note: '平方是整個括號自己乘自己，x 和 3 會互相乘兩次，多出 6x。' },
    practice: [
      { q: '(x + 2)² = ?', opts: ['x² + 4', 'x² + 4x + 4', 'x² + 2x + 4'], ok: 1 },
      { q: '(a - 3)² = ?', opts: ['a² - 9', 'a² + 9', 'a² - 6a + 9'], ok: 2 },
    ],
    transfer: { q: '(x + 4)² = ?', opts: ['x² + 16', 'x² + 8x + 16', 'x² + 4x + 16'], ok: 1 },
    retest: { q: '(2x + 3)² = ?', opts: ['4x² + 9', '4x² + 12x + 9', '4x² + 6x + 9', '2x² + 12x + 9'], ok: 1 },
    explain: {
      prompt: '為什麼 (a + b)² 不是 a² + b²？用你自己的話講。',
      concepts: [
        { label: '平方是整個括號自己乘自己', re: /自己乘|乘兩次|乘自己|\(a\+b\)\(a\+b\)|兩個括號|兩次/ },
        { label: '每一項都要乘到', re: /每一項|分配|都要乘|乘開|交叉|每個都/ },
        { label: '中間多出 2ab', re: /2ab|中間|兩個ab|兩塊|中間項|ab和ba/ },
      ],
      need: 2,
      sample: '平方的意思是整個括號自己乘自己，所以是 (a+b)(a+b)。每一項都要乘到，a 乘 b、b 乘 a 會多出兩塊 ab，中間就是 2ab，不能只寫 a² + b²。',
    },
    coach: {
      photo: '(x + 5)²',
      prompt: '把 (x + 5)² 展開',
      final: 'x² + 10x + 25',
      steps: [
        {
          ask: '先不急著算。平方就是自己乘自己，(x + 5)² 可以寫成哪兩個東西相乘？',
          accept: ['(x+5)(x+5)'],
          chips: ['(x + 5)(x + 5)', 'x² · 5²', '2(x + 5)'],
          wrong: [
            { match: 'x²·5²', say: '我看到你把 x 和 5 分開平方了。平方的是「整個括號」，所以要乘兩次的是什麼？' },
            { match: '2(x+5)', say: '平方是乘兩次，不是乘以 2。3² 是 3 × 3，那 (x + 5)² 呢？' },
          ],
          hints: ['先看「平方」這兩個字：誰自己乘自己？', '3² 是 3 × 3。那 (x + 5)² 是 (x + 5) 乘什麼？'],
          demo: '(x + 2)² = (x + 2)(x + 2)',
        },
        {
          ask: '兩個括號相乘，每一項都要乘到另一邊的每一項。會得到哪四塊？',
          accept: ['x²+5x+5x+25'],
          chips: ['x² + 5x + 5x + 25', 'x² + 25', 'x² + 5x + 25'],
          wrong: [
            { match: 'x²+25', say: '你算了 x · x 和 5 · 5。那 x · 5 和 5 · x 這兩塊呢？' },
            { match: 'x²+5x+25', say: '快了。x · 5 算到了，另一個方向的 5 · x 呢？' },
          ],
          hints: ['左邊的 x 要乘右邊兩項，左邊的 5 也要。', '一共 2 × 2 = 4 塊。你寫了幾塊？'],
          demo: '(x + 2)(x + 2) = x² + 2x + 2x + 4',
        },
        {
          ask: '把同類項合起來，最後是？',
          accept: ['x²+10x+25'],
          chips: ['x² + 10x + 25', 'x² + 5x + 25', 'x² + 25x + 10'],
          wrong: [{ match: 'x²+5x+25', say: '5x 和 5x 是兩塊，加起來是幾個 x？' }],
          hints: ['哪兩塊都有 x？', '5x + 5x = ?'],
          demo: 'x² + 2x + 2x + 4 = x² + 4x + 4',
        },
      ],
    },
    classProblems: [
      { id: 'sq-cross-1', text: '(x + 3)² 展開，為什麼不是 x² + 9？' },
      { id: 'sq-cross-2', text: '用正方形面積畫出 (a + b)²，數數看有幾塊' },
    ],
  },

  'sign-dist': {
    chapter: 'poly',
    title: '減去括號，每一項都要變號',
    short: '括號前的負號',
    why: '負號只改了括號裡第一項，後面幾項忘了跟著變號。',
    tonight: '今晚可以問他：「10 − (3 + 2) 和 10 − 3 + 2，為什麼答案不一樣？」',
    warm: { q: '10 - (3 + 2) 和 10 - 3 + 2 一樣嗎？', opts: ['一樣', '不一樣'], ok: 1 },
    board: { wrong: '(4x + 3) - (x - 2) = 3x + 1', right: '(4x + 3) - (x - 2) = 3x + 5', note: '減號要分給括號裡的每一項：−(x − 2) = −x + 2。' },
    practice: [
      { q: '-(2x - 7) = ?', opts: ['-2x - 7', '-2x + 7', '2x + 7'], ok: 1 },
      { q: '(6x + 1) - (2x + 5) = ?', opts: ['4x + 6', '4x - 4', '8x - 4'], ok: 1 },
    ],
    transfer: { q: '(5x - 2) - (3x - 4) = ?', opts: ['2x - 6', '2x + 2', '8x - 6'], ok: 1 },
    retest: { q: '(2x² + x - 3) - (x² - 4x - 1) = ?', opts: ['x² + 5x - 2', 'x² - 3x - 4', 'x² + 5x - 4', '3x² - 3x - 4'], ok: 0 },
    explain: {
      prompt: '減去一個括號時，為什麼括號裡每一項都要變號？',
      concepts: [
        { label: '減號像乘上 −1', re: /負號|減號|-1|負1|乘進去|分配|乘上/ },
        { label: '每一項都要算到', re: /每一項|全部|每個|所有|每一個/ },
        { label: '變號（加變減、減變加）', re: /變號|相反|反過來|加變減|減變加|正變負|負變正/ },
      ],
      need: 2,
      sample: '括號前面的減號就像乘上 -1，要分配給括號裡的每一項，所以每一項都要變號，加變減、減變加，不能只改第一項。',
    },
    coach: {
      photo: '(4x + 3) - (x - 2)',
      prompt: '化簡 (4x + 3) − (x − 2)',
      final: '3x + 5',
      steps: [
        {
          ask: '括號前面是減號。先把括號拿掉，−(x − 2) 會變成什麼？',
          accept: ['-x+2'],
          chips: ['-x + 2', '-x - 2', 'x - 2'],
          wrong: [
            { match: '-x-2', say: '我看到 x 變號了，那 −2 呢？減號要分給括號裡的每一項。' },
            { match: 'x-2', say: '括號前面那個減號去哪了？它要跟著進去。' },
          ],
          hints: ['減號要分給括號裡的幾項？', '−(−2) 是正的還是負的？'],
          demo: '−(x − 3) = −x + 3',
        },
        {
          ask: '所以式子是 4x + 3 − x + 2。有 x 的項合起來是？',
          accept: ['3x'],
          chips: ['3x', '5x', '4x'],
          wrong: [{ match: '5x', say: '4x 後面是「減」x，不是加。' }],
          hints: ['只看有 x 的：4x 和 −x。', '4 個 x 拿走 1 個 x，剩幾個？'],
          demo: '2x − x = x',
        },
        {
          ask: '常數也合起來，最後答案是？',
          accept: ['3x+5'],
          chips: ['3x + 5', '3x + 1', '5x + 5'],
          wrong: [{ match: '3x+1', say: '3 和 +2 合起來是多少？（剛剛 −2 已經變成 +2 了）' }],
          hints: ['常數是 3 和 +2。', '3 + 2 = ?'],
          demo: 'x + 1 + 3 = x + 4',
        },
      ],
    },
    classProblems: [
      { id: 'sign-dist-1', text: '(3x² − 2x + 1) − (x² − 5x + 4) 化簡' },
      { id: 'sign-dist-2', text: '−(2x − 7) 拿掉括號，每一項怎麼變？' },
    ],
  },

  'sqrt-split': {
    chapter: 'sqrt',
    title: '根號裡面要先算完',
    short: '根號不能拆開加',
    why: '把 √(9+16) 拆成 √9 + √16，但根號不能對加法拆開。',
    tonight: '今晚可以問他：「√(9 + 16) 跟 √9 + √16，哪一個是 5？為什麼？」',
    warm: { q: '√(9 + 16) 和 √9 + √16 一樣嗎？', opts: ['一樣', '不一樣'], ok: 1 },
    board: { wrong: '√(9 + 16) = 3 + 4 = 7', right: '√(9 + 16) = √25 = 5', note: '根號是一個整體，要先把裡面算完再開根號。' },
    practice: [
      { q: '√(16 + 9) = ?', opts: ['7', '5', '25'], ok: 1 },
      { q: '√(100 - 36) = ?', opts: ['4', '8', '64'], ok: 1 },
    ],
    transfer: { q: '√(36 + 64) = ?', opts: ['14', '10', '100'], ok: 1 },
    retest: { q: '√(25 - 9) = ?', opts: ['2', '4', '16'], ok: 1 },
    explain: {
      prompt: '為什麼 √(9 + 16) 不等於 √9 + √16？',
      concepts: [
        { label: '先算根號裡面', re: /先算|裡面|括號內|25|先加/ },
        { label: '根號不能對加法拆開', re: /不能.{0,4}拆|不可以.{0,4}拆|不能分開|不能分/ },
        { label: '驗算兩邊不一樣', re: /5|7|不一樣|不相等|驗算|不同/ },
      ],
      need: 2,
      sample: '根號要先把裡面算完，9 加 16 是 25，開根號是 5。如果拆開變成 3 加 4 等於 7，兩個不一樣，所以根號不能對加法拆開。',
    },
    coach: {
      photo: '√(144 + 25)',
      prompt: '算出 √(144 + 25)',
      final: '13',
      steps: [
        {
          ask: '根號裡面是一個加法。先不開根號，裡面加起來是多少？',
          accept: ['169'],
          chips: ['169', '17', '12 + 5'],
          wrong: [
            { match: '17', say: '17 是 12 + 5，你已經先開根號了。我們先只看根號裡面。' },
            { match: '12+5', say: '這是先拆開再開根號。先別拆，裡面 144 + 25 是多少？' },
          ],
          hints: ['只看根號裡面：144 + 25。', '144 + 25 = ?'],
          demo: '√(9 + 16)：先算 9 + 16 = 25',
        },
        {
          ask: '169 是哪個數的平方？',
          accept: ['13'],
          chips: ['13', '17', '16'],
          wrong: [{ match: '17', say: '17 × 17 = 289，太大了。再小一點？' }],
          hints: ['12² = 144，再大一點。', '13 × 13 = ?'],
          demo: '25 = 5 × 5，所以是 5 的平方',
        },
        {
          ask: '所以 √(144 + 25) = ？',
          accept: ['13'],
          chips: ['13', '17', '169'],
          wrong: [{ match: '17', say: '√144 + √25 = 17，跟 13 不一樣。哪一個才是先把裡面算完的？' }],
          hints: ['你剛剛已經算出 169 是誰的平方。', '√169 = ?'],
          demo: '√(9 + 16) = √25 = 5',
        },
      ],
    },
    classProblems: [
      { id: 'sqrt-split-1', text: '√(9 + 16) 和 √9 + √16 一樣嗎？各算一次' },
      { id: 'sqrt-split-2', text: '√(36 + 64) = ?' },
    ],
  },

  'sqrt-abs': {
    chapter: 'sqrt',
    title: '√ 開出來一定不是負的',
    short: '√ 只取非負',
    why: '把 √((−5)²) 算成 −5，忘了 √ 只取不是負數的那個平方根。',
    tonight: '今晚可以問他：「25 的平方根有兩個，為什麼 √25 只有一個？」',
    warm: { q: '√25 等於多少？', opts: ['5', '-5', '±5'], ok: 0 },
    board: { wrong: '√((-5)²) = -5', right: '√((-5)²) = √25 = 5', note: '(−5)² 先變成 25，√ 只取不是負的那一個。' },
    practice: [
      { q: '√((-3)²) = ?', opts: ['-3', '3', '±3'], ok: 1 },
      { q: '√49 = ?', opts: ['7', '-7', '±7'], ok: 0 },
    ],
    transfer: { q: '√((-7)²) = ?', opts: ['7', '-7', '±7'], ok: 0 },
    retest: { q: '若 a = -3，√(a²) = ?', opts: ['3', '-3', '9'], ok: 0 },
    explain: {
      prompt: '為什麼 √((−5)²) 是 5，不是 −5？',
      concepts: [
        { label: '先平方變成 25', re: /25|先平方|平方完|平方後/ },
        { label: '√ 只取不是負的那個', re: /正的|不是負|非負|大於等於0|≥0|取正|正數/ },
        { label: '兩個平方根只取一個', re: /兩個|±|正負|絕對值|其中一個/ },
      ],
      need: 2,
      sample: '(-5) 先平方變成 25，25 的平方根有正負兩個，但 √ 這個符號只取不是負的那一個，所以是 5，不是 -5。',
    },
    coach: {
      photo: '√((-6)²)',
      prompt: '算出 √((−6)²)',
      final: '6',
      steps: [
        {
          ask: '先算根號裡面。(−6)² 是多少？',
          accept: ['36'],
          chips: ['36', '-36', '-12'],
          wrong: [
            { match: '-36', say: '(−6) × (−6)，負負會得到？' },
            { match: '-12', say: '平方是乘自己，不是乘以 2。' },
          ],
          hints: ['(−6)² = (−6) × (−6)。', '負數乘負數是正還是負？'],
          demo: '(−2)² = (−2) × (−2) = 4',
        },
        {
          ask: '√36 會是 6 還是 −6？√ 這個符號只取哪一個？',
          accept: ['6'],
          chips: ['6', '-6', '±6'],
          wrong: [
            { match: '-6', say: '(−6)² 和 6² 都是 36。√ 只拿不是負數的那一個，你覺得是？' },
            { match: '±6', say: '36 的平方根有兩個，這沒錯。但 √36 這個符號只指其中一個，是哪一個？' },
          ],
          hints: ['√ 的答案可以是負的嗎？', '36 的平方根是 ±6，√36 只取「不是負的」。'],
          demo: '√4 只取不是負的那個，是 2',
        },
        {
          ask: '所以 √((−6)²) = ？',
          accept: ['6'],
          chips: ['6', '-6', '36'],
          wrong: [{ match: '-6', say: '回到上一步：√36 取哪一個？' }],
          hints: ['你上一步已經得到答案了。', '√((−6)²) = √36。'],
          demo: '√((−2)²) = √4 = 2',
        },
      ],
    },
    classProblems: [
      { id: 'sqrt-abs-1', text: '√((−5)²) 為什麼是 5，不是 −5？' },
      { id: 'sqrt-abs-2', text: 'a 是負數時，√(a²) 等於什麼？' },
    ],
  },

  'pyth-hyp': {
    chapter: 'pyth',
    title: '先認出哪一邊是斜邊',
    short: '分不清斜邊',
    why: '斜邊是直角對面最長的那條；把它當成股去加，就會算錯。',
    tonight: '今晚可以問他：「梯子靠在牆上，哪一條是斜邊？為什麼它最長？」',
    warm: { q: '直角三角形裡，哪一邊最長？', opts: ['斜邊', '兩股一樣長', '不一定'], ok: 0 },
    board: { wrong: '斜邊 13、一股 5：另一股 = √(13² + 5²)', right: '斜邊 13、一股 5：另一股 = √(13² - 5²) = 12', note: '斜邊的平方＝兩股平方的和。已知斜邊，求股要用減的。' },
    practice: [
      { q: '直角三角形兩股 3、4，斜邊 = ?', opts: ['5', '7', '√7'], ok: 0 },
      { q: '直角三角形斜邊 13、一股 12，另一股 = ?', opts: ['5', '√313', '1'], ok: 0 },
    ],
    transfer: { q: '直角三角形兩股 5 和 12，斜邊 = ?', opts: ['13', '17', '√119'], ok: 0 },
    retest: { q: '直角三角形斜邊 10、一股 6，另一股 = ?', opts: ['8', '√136', '4'], ok: 0 },
    explain: {
      prompt: '用畢氏定理之前，為什麼要先找出斜邊？',
      concepts: [
        { label: '斜邊在直角對面', re: /直角對面|對面|對邊/ },
        { label: '斜邊最長', re: /最長|最大/ },
        { label: '斜邊平方＝兩股平方和', re: /兩股|平方和|相加|a²\+b²|c²|斜邊的平方|用減的|要減/ },
      ],
      need: 2,
      sample: '斜邊是直角對面、最長的那一條。畢氏定理是斜邊的平方等於兩股平方相加，如果已知斜邊求股就要用減的，所以要先認出哪一條是斜邊。',
    },
    coach: {
      photo: '直角三角形：斜邊 17、一股 8，求另一股',
      prompt: '斜邊 17、一股 8，求另一股',
      final: '15',
      steps: [
        {
          ask: '先找斜邊。直角對面、最長的那條是幾？',
          accept: ['17'],
          chips: ['17', '8', '不知道'],
          wrong: [
            { match: '8', say: '8 比 17 短。斜邊一定是三條裡最長的那一條。' },
            { match: '不知道', say: '沒關係。三條邊裡最長的是哪一條？斜邊就是它。' },
          ],
          hints: ['斜邊在直角的對面。', '17 和 8，哪個比較長？'],
          demo: '斜邊 5、一股 3：斜邊是 5（最長）',
        },
        {
          ask: '斜邊的平方＝兩股平方相加。所以 另一股² = 17² − 8² = ？',
          accept: ['225'],
          chips: ['225', '353', '81'],
          wrong: [
            { match: '353', say: '你把兩個平方加起來了。17 是斜邊，它的平方已經是「兩股加起來」，所以求股要？' },
            { match: '81', say: '81 是 (17 − 8)²。要先各自平方再相減。' },
          ],
          hints: ['17² = 289，8² = 64。', '289 − 64 = ?'],
          demo: '另一股² = 5² − 3² = 25 − 9 = 16',
        },
        {
          ask: '225 開根號，另一股是？',
          accept: ['15'],
          chips: ['15', '9', '25'],
          wrong: [{ match: '25', say: '25 × 25 = 625，太大了。幾乘自己是 225？' }],
          hints: ['1 _ × 1 _ = 225。', '15 × 15 = ?'],
          demo: '另一股 = √16 = 4',
        },
      ],
    },
    classProblems: [
      { id: 'pyth-hyp-1', text: '斜邊 13、一股 5，另一股是多少？' },
      { id: 'pyth-hyp-2', text: '梯長 10、離牆 6，梯子頂端多高？' },
    ],
  },

  'factor-diff': {
    chapter: 'factor',
    title: '平方差：一個加、一個減',
    short: '平方差拆錯',
    why: '把 x² − 9 寫成 (x − 3)²，但 (x − 3)² 展開會多出 −6x。',
    tonight: '今晚可以問他：「x² − 9 為什麼是 (x + 3)(x − 3)？中間的項跑去哪了？」',
    warm: { q: '(x + 3)(x - 3) 展開是？', opts: ['x² - 9', 'x² + 9', 'x² - 6x - 9'], ok: 0 },
    board: { wrong: 'x² - 9 = (x - 3)²', right: 'x² - 9 = (x + 3)(x - 3)', note: '一個加、一個減，中間的 3x 和 −3x 會抵消。' },
    practice: [
      { q: 'x² - 16 = ?', opts: ['(x - 4)²', '(x + 4)(x - 4)', '(x + 8)(x - 8)'], ok: 1 },
      { q: '9x² - 1 = ?', opts: ['(3x + 1)(3x - 1)', '(3x - 1)²', '(9x + 1)(x - 1)'], ok: 0 },
    ],
    transfer: { q: 'x² - 25 = ?', opts: ['(x + 5)(x - 5)', '(x - 5)²', '(x + 5)²'], ok: 0 },
    retest: { q: '4x² - 1 = ?', opts: ['(2x + 1)(2x - 1)', '(2x - 1)²', '(4x + 1)(x - 1)'], ok: 0 },
    explain: {
      prompt: '為什麼 x² − 9 是 (x + 3)(x − 3)，不是 (x − 3)²？',
      concepts: [
        { label: '9 是 3 的平方（平方差）', re: /平方差|9是3|3的平方|a²-b²/ },
        { label: '一個加、一個減', re: /一加一減|一個加一個減|一個加.*一個減|相反|\+3.*-3/ },
        { label: '展開後中間項抵消', re: /展開|抵消|中間|-6x|驗算|乘回去|消掉/ },
      ],
      need: 2,
      sample: '9 是 3 的平方，所以是平方差，要拆成一個加一個減。乘回去檢查，中間的 3x 和 -3x 會抵消，剩下 x² - 9；(x - 3)² 展開會多出 -6x。',
    },
    coach: {
      photo: 'x² - 49',
      prompt: '因式分解 x² − 49',
      final: '(x + 7)(x − 7)',
      steps: [
        {
          ask: '49 是誰的平方？',
          accept: ['7'],
          chips: ['7', '49', '24.5'],
          wrong: [{ match: '24.5', say: '24.5 是 49 的一半。平方是「自己乘自己」，幾乘幾是 49？' }],
          hints: ['幾 × 幾 = 49？', '7 × 7 = ?'],
          demo: 'x² − 4：4 = 2²',
        },
        {
          ask: '所以是 x² − 7²。平方差會拆成一個加、一個減，寫出來是？',
          accept: ['(x+7)(x-7)', '(x-7)(x+7)'],
          chips: ['(x + 7)(x - 7)', '(x - 7)²', '(x + 7)²'],
          wrong: [
            { match: '(x-7)²', say: '把 (x − 7)² 展開看看，會多出哪一項？' },
            { match: '(x+7)²', say: '(x + 7)² 展開後最後一項是 +49，我們要的是 −49。' },
          ],
          hints: ['兩個括號，一個 +7、一個 −7。', '(x + ?)(x − ?)'],
          demo: 'x² − 2² = (x + 2)(x − 2)',
        },
        {
          ask: '乘回去檢查：(x + 7)(x − 7) = ？',
          accept: ['x²-49'],
          chips: ['x² - 49', 'x² - 14x + 49', 'x² + 49'],
          wrong: [{ match: 'x²-14x+49', say: '那是 (x − 7)²。這次一個 +7x、一個 −7x，加起來是？' }],
          hints: ['中間兩塊是 −7x 和 +7x。', '−7x + 7x = ?'],
          demo: '(x + 2)(x − 2) = x² − 2x + 2x − 4 = x² − 4',
        },
      ],
    },
    classProblems: [
      { id: 'factor-diff-1', text: 'x² − 9 因式分解，為什麼不是 (x − 3)²？' },
      { id: 'factor-diff-2', text: '4x² − 25 因式分解' },
    ],
  },

  'factor-cross': {
    chapter: 'factor',
    title: '十字交乘要顧到符號',
    short: '十字交乘的符號',
    why: '只找乘起來是 6 的兩個數，沒檢查加起來要是 −5，符號就反了。',
    tonight: '今晚可以問他：「找兩個數乘起來是 6、加起來是 −5，是哪兩個？怎麼找的？」',
    warm: { q: '哪兩個數乘起來是 6、加起來是 -5？', opts: ['-2 和 -3', '2 和 3', '-1 和 -6'], ok: 0 },
    board: { wrong: 'x² - 5x + 6 = (x + 2)(x + 3)', right: 'x² - 5x + 6 = (x - 2)(x - 3)', note: '兩個數要同時滿足：乘起來 +6、加起來 −5。' },
    practice: [
      { q: 'x² + 5x + 6 = ?', opts: ['(x + 2)(x + 3)', '(x - 2)(x - 3)', '(x + 1)(x + 6)'], ok: 0 },
      { q: 'x² - 2x - 8 = ?', opts: ['(x - 4)(x + 2)', '(x + 4)(x - 2)', '(x - 8)(x + 1)'], ok: 0 },
    ],
    transfer: { q: 'x² - 7x + 12 = ?', opts: ['(x - 3)(x - 4)', '(x + 3)(x + 4)', '(x - 2)(x - 6)'], ok: 0 },
    retest: { q: 'x² + x - 6 = ?', opts: ['(x + 3)(x - 2)', '(x - 3)(x + 2)', '(x + 6)(x - 1)'], ok: 0 },
    explain: {
      prompt: '分解 x² − 5x + 6 時，你找的兩個數要滿足哪兩件事？',
      concepts: [
        { label: '乘起來是常數項', re: /乘起來|相乘|乘積|乘是6|乘等於6/ },
        { label: '加起來是一次項係數', re: /加起來|相加|和是|-5|負5/ },
        { label: '注意符號', re: /負|符號|兩個都是負|同號|異號/ },
      ],
      need: 2,
      sample: '要找兩個數，乘起來是 6、加起來是 -5。乘起來是正的代表同號，加起來是負的所以兩個都是負的，是 -2 和 -3。',
    },
    coach: {
      photo: 'x² - 8x + 15',
      prompt: '因式分解 x² − 8x + 15',
      final: '(x − 3)(x − 5)',
      steps: [
        {
          ask: '找兩個數：乘起來是 15、加起來是 −8。哪一組？',
          accept: ['-3和-5', '-5和-3'],
          chips: ['-3 和 -5', '3 和 5', '-1 和 -15'],
          wrong: [
            { match: '3和5', say: '3 × 5 = 15 對了。但 3 + 5 是多少？我們要的是 −8。' },
            { match: '-1和-15', say: '乘起來 15 沒錯。加起來是 −16，不是 −8。' },
          ],
          hints: ['乘起來是正的 → 兩個數同號；加起來是負的 → 都是負的。', '15 = 3 × 5 = 1 × 15，哪一組加起來是 8？'],
          demo: 'x² − 5x + 6：乘 6、加 −5 → −2 和 −3',
        },
        {
          ask: '所以寫成兩個括號相乘？',
          accept: ['(x-3)(x-5)', '(x-5)(x-3)'],
          chips: ['(x - 3)(x - 5)', '(x + 3)(x + 5)', '(x - 3)(x + 5)'],
          wrong: [{ match: '(x+3)(x+5)', say: '你剛剛找到的是 −3 和 −5，括號裡的符號要跟著它們。' }],
          hints: ['(x + 第一個數)(x + 第二個數)。', '第一個數是 −3。'],
          demo: '(x − 2)(x − 3)',
        },
        {
          ask: '乘回去檢查中間項：−3x 和 −5x 加起來是？',
          accept: ['-8x'],
          chips: ['-8x', '8x', '-2x'],
          wrong: [{ match: '8x', say: '兩個都是負的，加起來會是正的嗎？' }],
          hints: ['−3 − 5 = ?', '後面再接一個 x。'],
          demo: '−2x − 3x = −5x，跟原式一樣',
        },
      ],
    },
    classProblems: [
      { id: 'factor-cross-1', text: 'x² − 5x + 6 因式分解（符號怎麼決定？）' },
      { id: 'factor-cross-2', text: 'x² + x − 12 因式分解' },
    ],
  },

  'quad-zero': {
    chapter: 'quad',
    title: '不能隨便兩邊除以 x',
    short: '弄丟 x = 0',
    why: 'x² = 3x 兩邊除以 x，會把 x = 0 這個解弄丟。',
    tonight: '今晚可以問他：「x² = 3x 有幾個解？為什麼不能直接兩邊除以 x？」',
    warm: { q: 'a × b = 0，代表什麼？', opts: ['a 或 b 至少一個是 0', 'a 和 b 都是 0', '不一定'], ok: 0 },
    board: { wrong: 'x² = 3x → x = 3', right: 'x² - 3x = 0 → x(x - 3) = 0 → x = 0 或 x = 3', note: 'x 可能是 0，不能拿它當除數。先移項再因式分解。' },
    practice: [
      { q: '解 x(x - 2) = 0', opts: ['x = 2', 'x = 0 或 x = 2', 'x = 0 或 x = -2'], ok: 1 },
      { q: '解 x² = 7x', opts: ['x = 7', 'x = 0 或 x = 7', 'x = ±7'], ok: 1 },
    ],
    transfer: { q: '解 x² = 5x', opts: ['x = 0 或 x = 5', 'x = 5', 'x = 0'], ok: 0 },
    retest: { q: '解 2x² = 6x', opts: ['x = 0 或 x = 3', 'x = 3', 'x = 0 或 x = -3'], ok: 0 },
    explain: {
      prompt: '解 x² = 3x 時，為什麼不能直接兩邊除以 x？',
      concepts: [
        { label: 'x 可能是 0', re: /可能是0|x=0|等於0|是零|x是0|可能為0/ },
        { label: '不能除以 0', re: /不能除以0|除以零|除以0|不能當除數/ },
        { label: '先移項、因式分解', re: /移項|提出|因式分解|x\(x-3\)|兩個解|公因式/ },
      ],
      need: 2,
      sample: '因為 x 可能是 0，不能除以 0。要先移項變成 x² - 3x = 0，提出 x 變成 x(x - 3) = 0，所以有兩個解，x = 0 或 x = 3。',
    },
    coach: {
      photo: '解 x² = 4x',
      prompt: '解 x² = 4x',
      final: 'x = 0 或 x = 4',
      steps: [
        {
          ask: '先不要除。把 4x 移到左邊，式子變成？',
          accept: ['x²-4x=0'],
          chips: ['x² - 4x = 0', 'x = 4', 'x² + 4x = 0'],
          wrong: [
            { match: 'x=4', say: '這是兩邊除以 x 了。我們先不除，把 4x 搬到左邊看看。' },
            { match: 'x²+4x=0', say: '移到另一邊要變號，+4x 過去會變成？' },
          ],
          hints: ['兩邊同時減掉 4x。', 'x² − 4x = ?'],
          demo: 'x² = 2x → x² − 2x = 0',
        },
        {
          ask: '左邊提出公因式 x，寫成？',
          accept: ['x(x-4)=0'],
          chips: ['x(x - 4) = 0', 'x(x + 4) = 0', '(x - 4)² = 0'],
          wrong: [{ match: 'x(x+4)=0', say: '把 x(x + 4) 乘回去是 x² + 4x，跟 x² − 4x 差在哪？' }],
          hints: ['x² 和 4x 都有 x。', 'x² − 4x = x · (？)'],
          demo: 'x² − 2x = x(x − 2)',
        },
        {
          ask: '兩個數相乘等於 0，至少一個是 0。所以解是？',
          accept: ['x=0或x=4', 'x=4或x=0'],
          chips: ['x = 0 或 x = 4', 'x = 4', 'x = 0'],
          wrong: [
            { match: 'x=4', say: 'x = 4 對。那 x 這個因式等於 0 的時候呢？' },
            { match: 'x=0', say: 'x = 0 對。另一個括號 (x − 4) 等於 0 的時候呢？' },
          ],
          hints: ['x = 0，或 x − 4 = 0。', '兩個都是答案。'],
          demo: 'x(x − 2) = 0 → x = 0 或 x = 2',
        },
      ],
    },
    classProblems: [
      { id: 'quad-zero-1', text: '解 x² = 3x，為什麼不能兩邊除以 x？' },
      { id: 'quad-zero-2', text: 'x(x − 2) = 0 和 (x − 2)² = 0 的解差在哪？' },
    ],
  },
};

// ——— 初步診斷：8 題國二上數學 ———
// tag：選了這個錯的選項，代表卡在哪一步
export const DIAG_QUESTIONS = [
  { id: 'q1', skill: 'sq-cross', q: '(x + 3)² = ?', opts: [
    { t: 'x² + 9', tag: 'sq-cross' }, { t: 'x² + 6x + 9', ok: true }, { t: 'x² + 3x + 9', tag: 'sq-cross' }, { t: 'x² + 6x + 6', tag: null },
  ] },
  { id: 'q2', skill: 'sign-dist', q: '(3x² - 2x + 1) - (x² - 5x + 4) = ?', opts: [
    { t: '2x² + 3x - 3', ok: true }, { t: '2x² - 7x + 5', tag: 'sign-dist' }, { t: '2x² + 3x + 5', tag: 'sign-dist' }, { t: '4x² - 7x + 5', tag: 'sign-dist' },
  ] },
  { id: 'q3', skill: 'sqrt-split', q: '√(9 + 16) = ?', opts: [
    { t: '7', tag: 'sqrt-split' }, { t: '5', ok: true }, { t: '25', tag: null },
  ] },
  { id: 'q4', skill: 'sqrt-abs', q: '√((-5)²) = ?', opts: [
    { t: '5', ok: true }, { t: '-5', tag: 'sqrt-abs' }, { t: '±5', tag: 'sqrt-abs' },
  ] },
  { id: 'q5', skill: 'pyth-hyp', q: '直角三角形斜邊 13、一股 5，另一股 = ?', opts: [
    { t: '12', ok: true }, { t: '√194', tag: 'pyth-hyp' }, { t: '8', tag: 'pyth-hyp' },
  ] },
  { id: 'q6', skill: 'factor-diff', q: 'x² - 9 因式分解 = ?', opts: [
    { t: '(x + 3)(x - 3)', ok: true }, { t: '(x - 3)²', tag: 'factor-diff' }, { t: '(x - 9)(x + 1)', tag: 'factor-diff' },
  ] },
  { id: 'q7', skill: 'factor-cross', q: 'x² - 5x + 6 因式分解 = ?', opts: [
    { t: '(x + 2)(x + 3)', tag: 'factor-cross' }, { t: '(x - 2)(x - 3)', ok: true }, { t: '(x + 1)(x - 6)', tag: 'factor-cross' },
  ] },
  { id: 'q8', skill: 'quad-zero', q: '解 x² = 3x', opts: [
    { t: 'x = 0 或 x = 3', ok: true }, { t: 'x = 3', tag: 'quad-zero' }, { t: 'x = 0', tag: 'quad-zero' },
  ] },
];

export const UNSURE = -1;

/**
 * 依作答判出 1–2 個卡點。
 * answers: { [qid]: 選項索引 | UNSURE }
 * 規則：選到帶 tag 的錯誤選項 +2；錯但沒 tag、或選「不確定」+1（算在該題的卡點）。
 * 分數 ≥ 2 的依分數、再依課程順序排，取前 2 個；都沒有就取分數 1 的第一個；全對則標 allClear。
 */
export function diagnose(answers) {
  const scores = {};
  const status = {};
  let correct = 0;
  for (const q of DIAG_QUESTIONS) {
    const a = answers[q.id];
    if (a === undefined) continue;
    if (a === UNSURE) {
      scores[q.skill] = (scores[q.skill] || 0) + 1;
      continue;
    }
    const opt = q.opts[a];
    if (!opt) continue;
    if (opt.ok) { correct++; status[q.skill] = status[q.skill] || 'ok'; continue; }
    const target = opt.tag || q.skill;
    scores[target] = (scores[target] || 0) + (opt.tag ? 2 : 1);
  }
  const rank = (a, b) => (scores[b] - scores[a]) || (SKILL_ORDER.indexOf(a) - SKILL_ORDER.indexOf(b));
  let stuck = Object.keys(scores).filter((k) => scores[k] >= 2).sort(rank).slice(0, 2);
  if (!stuck.length) stuck = Object.keys(scores).filter((k) => scores[k] >= 1).sort(rank).slice(0, 1);
  const allClear = stuck.length === 0;
  if (allClear) stuck = ['factor-cross']; // 全對：從學校正在教的因式分解開始把它練穩
  for (const s of stuck) status[s] = 'stuck';
  for (const k of Object.keys(scores)) if (!status[k]) status[k] = 'unknown';
  return { stuck, scores, correct, total: DIAG_QUESTIONS.length, allClear, status };
}

// ——— 時段 ———
export const DAYS = ['一', '二', '三', '四', '五', '六', '日'];
export const SLOT_TIMES = ['14:00', '19:00', '20:00'];
// 平日下午不開
export function slotEnabled(day, time) { return !(day < 5 && time === '14:00'); }
export function slotId(day, time) { return `d${day}-${time.replace(':', '')}`; }
export function parseSlot(id) {
  const m = /^d(\d)-(\d{2})(\d{2})$/.exec(id || '');
  if (!m) return null;
  return { day: Number(m[1]), time: `${m[2]}:${m[3]}` };
}
export function slotLabel(id) {
  const s = parseSlot(id);
  if (!s) return '';
  const [h, mm] = s.time.split(':').map(Number);
  const end = `${String(h).padStart(2, '0')}:${String(mm + 50).padStart(2, '0')}`;
  return `週${DAYS[s.day]} ${s.time}–${end}`;
}
// 示範用的「同卡點、同進度、有空」人數（虛構）
const SLOT_DEMAND = { 'd2-1900': 9, 'd2-2000': 6, 'd0-1900': 5, 'd4-2000': 5, 'd5-1400': 7, 'd5-1900': 4, 'd6-1400': 6, 'd1-1900': 4, 'd3-1900': 5 };
export function slotDemand(id) { return SLOT_DEMAND[id] ?? 3; }
/** 從選的格子裡挑能湊成隊、人最多的那一格 */
export function pickBestSlot(slots) {
  if (!slots || !slots.length) return null;
  return [...slots].sort((a, b) => (slotDemand(b) - slotDemand(a)) || a.localeCompare(b))[0];
}

// ——— 小隊與老師（虛構） ———
export const AVATAR_COLORS = ['#DCEFE8', '#F9D3C9', '#FBE7B2', '#C9DDF8', '#DDD2F6', '#CFEBDD'];
export const TEAMMATES = [
  { id: 'm-an', name: '小安', color: 1, plan: '8' },
  { id: 'm-qing', name: '小晴', color: 2, plan: '8' },
  { id: 'm-zhe', name: '阿哲', color: 3, plan: '4' },
  { id: 'm-en', name: '小恩', color: 4, plan: '8' },
  { id: 'm-yu', name: '小宇', color: 5, plan: '8+1' },
];
export const TEACHER = {
  name: '林老師',
  intro: '國中數學老師。擅長帶「知道規則、說不出為什麼」的那種卡住。',
  voice: '我不會一直講。我們先看大家卡在哪一步，再輪流講給隊友聽。',
};

/**
 * 依學生的卡點與時段湊一隊（示範：虛構隊友 4 人，含自己 5 人）
 * 大部分隊友卡在同一步，另有 1–2 人的第二卡點不同，方便老師分組。
 */
export function buildSquad({ name, stuck, slot, firstDate, size = 4 }) {
  const main = stuck[0];
  const alt = SKILL_ORDER.filter((k) => !stuck.includes(k));
  const members = [{ id: 'me', name, color: 0, plan: null, isMe: true, stuck: [...stuck] }];
  TEAMMATES.slice(0, size).forEach((t, i) => {
    const second = i % 2 === 0 ? (stuck[1] || alt[i % alt.length]) : alt[(i + 2) % alt.length];
    const own = i === 3 ? [alt[1]] : [main, second]; // 第 4 位：主卡點不同（已經會了，可以當講的人）
    members.push({ ...t, stuck: own, isMe: false, ready: i === 3 });
  });
  return { id: `sq-${slot}-${main}`, slot, firstDate, members, status: 'forming', teacher: TEACHER.name };
}

// ——— 8 週課表 ———
export const PHASES = {
  fix: { name: '補洞', cls: 'ph-fix' },
  exam: { name: '段考訂正', cls: 'ph-exam' },
  school: { name: '跟上學校', cls: 'ph-school' },
  sprint: { name: '衝刺', cls: 'ph-sprint' },
};
const SCHOOL_TOPICS = {
  '國二': ['因式分解：提公因式', '因式分解：用乘法公式', '因式分解：十字交乘'],
  '國三': ['相似形', '圓：圓心角與圓周角', '圓：切線'],
};
export function syllabus(stuck, grade = '國二') {
  const s1 = SKILLS[stuck[0]] || SKILLS['sq-cross'];
  const s2 = stuck[1] ? SKILLS[stuck[1]] : null;
  const school = SCHOOL_TOPICS[grade] || SCHOOL_TOPICS['國二'];
  return [
    { w: 1, phase: 'fix', topic: s1.title, skill: stuck[0] },
    { w: 2, phase: 'fix', topic: s2 ? s2.title : `${s1.title}（變化題）`, skill: stuck[1] || stuck[0] },
    { w: 3, phase: 'exam', topic: '段考訂正：用自己的錯題再走一次', skill: stuck[0] },
    { w: 4, phase: 'school', topic: school[0], checkpoint: true, skill: stuck[1] || stuck[0] },
    { w: 5, phase: 'school', topic: school[1], skill: stuck[0] },
    { w: 6, phase: 'school', topic: school[2], skill: stuck[1] || stuck[0] },
    { w: 7, phase: 'sprint', topic: '衝刺：段考範圍混合題', skill: stuck[0] },
    { w: 8, phase: 'sprint', topic: '衝刺：模擬段考＋訂正', skill: stuck[1] || stuck[0] },
  ];
}

// ——— 小隊課六段 ———
export const SEGMENTS = [
  { key: 'warm', name: '暖身', min: 5 },
  { key: 'common', name: '大家常錯的', min: 10 },
  { key: 'try', name: '自己試試', min: 10 },
  { key: 'again', name: '再帶一次', min: 5 },
  { key: 'teach', name: '講給隊友聽', min: 15 },
  { key: 'got', name: '我搞懂的', min: 5 },
];

// ——— 課前一頁：由小隊的卡點彙整出候選題 ———
/**
 * members: [{ stuck: [skillId] }]；questions: 學生丟的問題
 * 回傳依「卡在這步的人數」排序的候選題
 */
export function prepCandidates(members, questions = []) {
  const count = {};
  for (const m of members) for (const s of m.stuck || []) count[s] = (count[s] || 0) + 1;
  const ranked = Object.keys(count).sort((a, b) => (count[b] - count[a]) || (SKILL_ORDER.indexOf(a) - SKILL_ORDER.indexOf(b)));
  const out = [];
  // 先每個卡點各取第一題，再補第二題
  for (const round of [0, 1]) {
    for (const s of ranked) {
      const p = SKILLS[s].classProblems[round];
      if (p) out.push({ id: p.id, text: p.text, skill: s, count: count[s], source: `${count[s]} 人卡在這步` });
    }
  }
  questions.forEach((q, i) => out.splice(Math.min(2, out.length), 0, { id: `ask-${i}`, text: q.text, skill: null, count: 1, source: '隊友問的（匿名）' }));
  return out;
}
export function skillCounts(members) {
  const count = {};
  for (const m of members) for (const s of m.stuck || []) count[s] = (count[s] || 0) + 1;
  return SKILL_ORDER.filter((k) => count[k]).map((k) => ({ skill: k, count: count[k] })).sort((a, b) => b.count - a.count);
}

// ——— 段考對照 ———
const EXAM_BASE = { mult: 2, poly: 1, sqrt: 1, pyth: 1, factor: 2, quad: 1 };
/** 上一次段考的錯題分布（示範考卷＋診斷的卡點） */
export function examBefore(stuck) {
  const c = { ...EXAM_BASE };
  for (const s of stuck) c[SKILLS[s].chapter] += 2;
  return c;
}
const STATUS_WEIGHT = { gold: 0, green: 0.35, learning: 0.65, stuck: 1, ok: 0.3, unknown: 0.8 };
/** 這一次段考：依卡點目前的狀態模擬（金色的點不再錯） */
export function examAfter(before, skillStatus) {
  const out = {};
  for (const ch of CHAPTERS) {
    const skills = SKILL_ORDER.filter((k) => SKILLS[k].chapter === ch.id);
    const w = skills.map((k) => STATUS_WEIGHT[skillStatus[k] || 'unknown']);
    const factor = w.reduce((a, b) => a + b, 0) / w.length;
    out[ch.id] = Math.max(0, Math.round(before[ch.id] * factor));
  }
  return out;
}
export function sumCounts(c) { return Object.values(c || {}).reduce((a, b) => a + b, 0); }

export const GOALS = ['段考數學進步', '不要再怕數學', '會考拿到 B++', '只想跟上就好'];
