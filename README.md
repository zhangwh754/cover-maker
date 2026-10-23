# 每日推荐封面生成器

支持离线 Android APK 和本地浏览器的封面生成器。输入原始图片、标题和分类，输出统一的 1080 × 1440 封面。采用 A「大图推荐」：全幅图片、左上角类型、底部标题和一段描述；不显示编号、栏目名和英文页脚。图片只做方向修正、缩放和可控裁切，不使用 AI 生图。

## 快速开始

需要 Node.js 22 或更新版本。

Android 安装、构建及数据保留说明见 [ANDROID.md](ANDROID.md)。已生成的安装包位于 `output/cover-maker-debug.apk`。

```bash
npm ci
npm run dev
```

在浏览器打开 <http://127.0.0.1:3001>。网页与 APK 都在本地生成图片并保存编号、历史记录；只有导入 HTTPS 图片直链需要联网。分类可自由输入或选择预设。APK 不需要公共服务器；构建命令为 `npm run android:apk`。

## 命令行

```bash
npm run cover -- --image input/sora.jpg --title "空之轨迹" --subtitle "the 2nd" --type game
```

输出默认放在 `output/`，文件名形如 `001-game-sora.png`。分类支持自由输入（最多 20 字符），也可使用 `anime`、`game`、`tv`、`life`、`coding` 或对应中文预设。网页可以点击预设按钮填入分类，也可直接修改输入框。自定义分类使用统一配色；文件名中的分类会移除路径等特殊字符。

常用参数：

| 参数 | 用途 |
| --- | --- |
| `--crop contain` | 完整显示原图 |
| `--crop cover --x 0.5 --y 0` | 默认铺满画布，焦点靠上；`x`、`y` 范围为 0～1 |
| `--format jpeg` | 导出高质量 JPEG；默认 PNG |
| `--index 42` | 手动编号，不修改自动编号记录 |
| `--output dir` | 指定输出目录 |
| `--sequence file` | 指定自动编号记录文件 |

比如保留海报顶部标志：

```bash
npm run cover -- --image input/sora.jpg --title "空之轨迹" --type game --crop cover --y 0 --format jpeg
```

## 编号与预览

桌面 CLI/服务端自动编号全栏目共用，记录在 `data/sequence.json`；APK 与离线网页保存在各自的本地 IndexedDB。编号只用于文件和记录，不出现在封面上。预览只读取下一编号；只有正式导出成功后才更新记录。手动编号不更新记录。同名输出文件不会被覆盖；自动导出遇到已占用的同名文件时会跳过该编号。

Web 页面预览与最终导出调用同一套渲染代码。JPEG 预览也使用与导出相同的编码选项。自动编号在多人同时使用时可能在预览后被其他生成任务占用，正式导出会返回实际编号。

当前页面的下载链接保留在“本次生成记录”中，继续编辑不会删除它们。刷新页面会清空页面记录，已导出的文件仍保存在 `output/`。修改内容时旧预览立即失效；生成期间继续编辑，也不会把旧导出结果显示为新内容的预览。窄窗口可用“查看预览”和“返回调整图片”在表单与预览间切换。

## HTTP API

| 接口 | 作用 |
| --- | --- |
| `GET /api/sequence` | 获取下一自动编号 |
| `POST /api/import-image` | 接收 JSON `{ "url": "https://..." }`，读取并返回公开网络图片 |
| `POST /api/preview` | 接收 multipart 表单，直接返回预览图片，不占用编号 |
| `POST /api/covers` | 生成并保存封面，返回编号、文件名和下载地址 |
| `GET /api/covers/:filename` | 下载已生成的图片 |

上传字段：`image`（文件）、`title`、`type`；可选 `subtitle`、`index`、`crop`（`contain` 或 `cover`）、`x`、`y`、`format`（`png` 或 `jpeg`）。上传文件最大 20 MB，解码图片上限为 2500 万像素。

## 字体与一致性

项目自带 Noto Sans SC Regular 和 Noto Serif SC Regular。渲染进程通过 `assets/fonts/fonts.conf` 只使用项目字体目录，避免不同系统的字体替换。字体文件的来源、校验值及许可证见 [字体说明](assets/fonts/README.md)。若修改字体或 Sharp 版本，输出像素可能变化。

## 开发验证

```bash
npm run build
npm test
```

测试覆盖图片尺寸、裁切焦点、长标题、自动与手动编号、并发编号、Web 预览与 PNG/JPEG 导出。
