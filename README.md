# 折面投影台 ＋ 滲 nijimi

兩個單檔、純瀏覽器的互動作品。不需要任何套件、不需要建置，雙擊 `index.html` 就能跑，手機也能玩。都是和 Claude Code 一起做的。

| | 折面投影台 `facetstage/` | 滲 nijimi `nijimi/` |
|---|---|---|
| 是什麼 | 投影映射（projection mapping）工具：把霓虹線稿、閃電色塊、角色和標題，依節拍「貼」到立體牆的每一個面上 | 互動流體：手指或滑鼠劃過，發光的墨水就在水裡暈開、捲起渦流 |
| 技術 | Canvas 2D、透視變形（homography）、Web Audio 節拍偵測、照片自動偵測平面（SLIC 超像素＋區域合併） | WebGL2 Navier–Stokes 流體模擬（advection / pressure / vorticity confinement）＋ bloom |
| 預覽 | ![](facetstage/shots/phone_3_dragged_lowpoly.png) | ![](nijimi/shots/contact_sheet.png) |

## 折面投影台

打開 `facetstage/index.html`（加 `?view=sim&play` 會直接以模擬牆面模式播放）。

- **描面**：上傳一張從投影機位置拍的牆面照片，按「✦ 自動偵測面」讓程式找出牆上的平面，或用「新增面」手動描點。相鄰面共用的角會一起動，可以拖曳或用方向鍵微調。
- **內容**：每個面自動產生霓虹描邊、方格／斜線／鋸齒圖樣，以及擦入的閃電色塊；角色插畫和文字用四個角做透視貼合。預設角色是程式畫的原創角色，可換成自己的圖。
- **節拍**：段落為 暗場 → 線稿 → 填色 → 角色 → 標題 → 收尾，每段幾拍可調；BPM 可輸入或點拍子，也能載入音樂或用麥克風，讓大鼓觸發閃動。
- **上場**：「開啟投影視窗」開出第二個視窗，拖到投影機螢幕、雙擊全螢幕，播放進度與主視窗同步。
- **手機**：設定面板可收合（☰ 設定）、觸控有放大的點擊範圍、「↺ 重設」回到初始狀態。

自動偵測面在測試圖上的結果（`facetstage/shots/auto_*_d5.png`）：天花板斜樑 5/5、手風琴摺紙 7/6、低多邊形牆 11/13；低對比的牆要把細緻度調高。拍照時要關掉投影、讓燈光平均；曲面、紋理很多的牆面、強烈陰影會偵測不準。

示範影片：[`facetstage/shots/demo.mp4`](facetstage/shots/demo.mp4)

## 滲 nijimi

打開 `nijimi/index.html`。

- 移動滑鼠／手指拖曳：沿路注入墨水；點擊：一團亮核加花瓣綻放；空白鍵：多處爆發；R 清除、F 全螢幕、H 隱藏介面、1–5 換色盤（翡翠、焰、藍、櫻、金）。
- 閒置 8 秒會進入自動模式，畫面不會停住。手機支援多指同時畫。
- 網址參數：`?debug`（fps 與畫質等級）、`?q=ultra|high|medium|low|min`、`?palette=fire`、`?transparent=1`（透明背景，可疊在其他畫面上）。
- 程式介面（可接聊天室指令或音樂節拍）：`window.__ink.splat(x, y, dx, dy)`、`bloom(x, y)`、`burst(n)`、`setPalette(name)`、`clear()`。
- 在 Intel UHD 630 內顯上 1920×1080 約 60 fps，掉幀時會自動降一級畫質。

## 測試工具

兩個專案的 `tools/` 是用無頭 Chrome 截圖、驗證互動的腳本（playwright-core）：

```bash
npm i playwright-core            # 或用 PW_FROM 指向已安裝 playwright-core 的位置
node facetstage/tools/autotest.mjs      # 各測試圖、各細緻度的自動偵測截圖
node facetstage/tools/phonetest.mjs     # 手機尺寸：上傳 → 偵測 → 套用 → 拖點
python facetstage/tools/make_synth.py   # 重新產生合成測試圖
node nijimi/tools/shoot.mjs             # 各色盤、爆發、自動模式、手機觸控截圖
node nijimi/tools/tiers.mjs             # 各畫質等級的 fps 與 GPU 時間
```

需要本機安裝的 Google Chrome（腳本用 `channel: 'chrome'` 並開 GPU）。

## 授權

MIT（見 `LICENSE`）。測試圖為程式合成；截圖與示範影片為本專案自行輸出。
