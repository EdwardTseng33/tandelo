# 向量圖需求單（給本地 codex 產圖）

雲端容器的網路政策擋住 api.openai.com，所以 codex 要在 Edward 的電腦上跑。做法：在 repo 根目錄執行下面任一段，產出的 SVG 放進指定路徑，再跑 `python3 frontend/assets/illustrations/_src/gen.py frontend/assets/illustrations` 以外的檢查（node --check 不管 SVG；CI 的禁字檢查會掃 .svg 以外的檔，SVG 裡仍然不要放任何品牌以外的字）。

```bash
codex exec --skip-git-repo-check "$(cat docs/codex-image-brief.md)"
```

## 共同規範（每一張都要符合）

- 只用品牌色：松綠 #0E5F52、深松 #0A463D、墨綠 #0D2B26、珊瑚 #F26B54、深珊瑚 #D9523C、蜂蜜金 #F4C24D、燕麥 #F6F4EE、薄荷 #DCEFE8、砂 #ECE9E1、線 #D9D5CA、迷霧 #E3DFD3。不用純黑，不用紅色代表錯。
- 幾何、平面、留白多；沒有漸層、陰影、濾鏡、點陣圖、外部連結、script。
- 人物是一顆頭加圓肩，沒有五官。怪的眼睛是白圓加墨綠瞳孔。
- 線條 1.9px 圓頭並加 `vector-effect="non-scaling-stroke"`；圖裡不放任何 `<text>`。
- 每張附深色版（檔名加 `-dark`）：底 #0C1412、卡 #131D1A、字轉亮、松綠改 #1F8C78，珊瑚與金不變。
- 怪的 symbol 一律用 CSS 變數上色：`fill="var(--m-body)"`、眼白 `var(--m-eye)`、瞳孔 `var(--m-pupil)`、細節 `var(--m-feat)`，另放 `<text fill="var(--m-zz)">z</text>` 與 `<text fill="var(--m-q)">?</text>` 供睡著與迷霧狀態（這是唯一允許的 text）。參考 `frontend/assets/monsters-defs.svg`。
- viewBox 固定；單檔 ≤ 12KB；不侵犯任何既有 IP。

## 要產的圖

1. **其他三片大陸的怪（9 隻 symbol）**，輸出 `frontend/assets/monsters-defs-2.svg`：
   - 英文 · 西風港：時光獸（過去式與現在完成式混用）、失蹤的 s（第三人稱單數忘加 s）、介係詞迷路怪（in／on／at 放錯）
   - 國文 · 字林：音近字妖（再／在、做／作）、之乎迷霧（文言「之」用法）、修辭變臉怪（譬喻與轉化分不清）
   - 社會 · 時光古道：年代錯置怪、因果顛倒獸、經緯迷航
   - 每隻 64×64，外形要和數學八隻有明顯差異，各帶一個對到「牠讓你犯的錯」的視覺細節。
2. **三片大陸地形**（西風港、字林、時光古道），輸出 `frontend/assets/worldmap-terrain-{en,zh,soc}.svg`，格式同 `frontend/assets/worldmap-terrain.svg`（只輸出 `<g>` 內容，class 名沿用 land／shore／tree／peak／river／cave／mesa，再各加 2 種新地形 class 並附 CSS 建議）。
3. **遠征六幕圖示**（整隊、偵察弱點、各自出手、嚮導示範一擊、合擊、清點戰利品），`frontend/assets/illustrations/act-{1..6}.svg`，480×360，各一深色版。
4. **十枚月徽章**（9 月乘法平原之月到 6 月，對應區域主題），`frontend/assets/illustrations/badge-{01..10}.svg`，120×120；金邊版用蜂蜜金外環。
5. **營地場景**（家人在營地等你回來：帳篷、營火、一位家長與一個孩子，夜景），`frontend/assets/illustrations/camp.svg`，1200×800，深色版。
6. **分享卡底圖**（4:5，直式，留中央給怪與文字），`frontend/assets/illustrations/share-bg.svg`，960×1200，淺深各一。

完成後回報：每檔大小、是否有 text、用了哪些顏色。
