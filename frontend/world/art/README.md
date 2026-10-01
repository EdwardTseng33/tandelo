# 美術掛載點（由本地 codex 產生）

把 codex 依 `docs/codex-image-brief.md` 產出的檔案放進這個資料夾，並放一個 `manifest.json`（例如 `{"version":"1"}`）。
Demo 啟動時偵測到 manifest 就會在 `<html>` 加上 `data-art`，`art.css` 的規則隨之生效；沒有這些檔案時，Demo 維持目前的向量版，不會壞。

檔名固定（SVG，淺色與深色各一，深色加 `-dark`）：

| 檔名 | 用在 | 尺寸 |
|---|---|---|
| `bg-home.svg` | 今天畫面頂部（隊伍旗與營地） | 390×220 |
| `bg-dungeon.svg` | 副本畫面頂部（多項式林深處） | 390×200 |
| `bg-wall.svg` | 圖鑑的夥伴牆夜景 | 390×220 |
| `bg-tower.svg` | 燈塔頁頂部（燈塔與光束） | 390×220 |
| `bg-capture.svg` | 收服時刻全幕背景 | 390×844 |
| `bg-guild.svg` | 公會頁頂部（營地） | 390×180 |
| `map-math.svg` | 數理大陸完整地圖（取代地形層） | 440×420 |
| `map-en.svg`、`map-zh.svg`、`map-soc.svg` | 西風港、字林、時光古道 | 440×420 |
| `kid-1.svg` … `kid-6.svg` | 六色隊員（頭加圓肩、無五官） | 64×64 |
| `guide.svg`、`patrol.svg` | 嚮導、巡查員 | 64×64 |
| `monsters-defs-2.svg` | 英文、國文、社會九隻怪的 symbol | 64×64 symbol |
| `art.css` | 把上面的檔接到畫面：`[data-art] .dg-hero{background-image:url(bg-dungeon.svg)}` 等 | — |

`art.css` 範例：

```css
[data-art] .dg-hero{background-image:url(bg-dungeon.svg)}
[data-art] .wall{background-image:url(bg-wall.svg)}
[data-art] .tower-hero{background-image:url(bg-tower.svg)}
[data-art] .capture{background-image:url(bg-capture.svg)}
@media (prefers-color-scheme: dark){[data-art]:not([data-theme="light"]) .dg-hero{background-image:url(bg-dungeon-dark.svg)}}
[data-art][data-theme="dark"] .dg-hero{background-image:url(bg-dungeon-dark.svg)}
```
