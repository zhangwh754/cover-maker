# 本地 Android 版

已生成可直接安装的 `output/cover-maker-debug.apk`，应用名“每日推荐封面”，包名 `com.covermaker.app`，最低 Android 7.0（API 24）。需要手机有可用且较新的 Android System WebView。

## 安装与使用

把 APK 通过 USB 或文件传输复制到手机，打开文件并按系统提示允许该文件管理器安装此应用。也可以自行执行 `adb install -r output/cover-maker-debug.apk`。不需要部署服务器、注册账号或购买服务。

本地选图、预览、PNG/JPEG 生成、自动编号、历史记录均可断网使用。新版采用 A「大图推荐」：类型、标题和一段描述，默认智能适配，按比例选择居中铺满或模糊背景＋完整原图；手动裁切支持缩放、位置调整和重置；类型支持自由输入和预设。封面不显示编号、栏目名或英文页脚。旧历史图片保留原样。只有主动导入 HTTPS 图片直链时联网；应用不上传本地原图。某些网站的防盗链或登录限制仍可能阻止导入。

生成后在“本地历史记录”中选择“查看”“保存图片”或“分享”。Android 10 及以上保存到相册 `Pictures/DailyRecommend`；Android 7–9 使用系统文件保存窗口。无需读取整个相册或申请广泛存储权限。

历史记录与编号保存在应用自己的 IndexedDB 中，不自动同步到云端。卸载或清除应用数据会丢失这些记录；重要封面请保存到相册。覆盖安装应保持同一包名和签名，避免卸载后重装。此 APK 使用本机 Android 调试签名，适合个人安装；后续在本机重建可覆盖更新，请保留本机调试签名密钥。正式长期分发前应另行配置并备份专用发布签名。

## 本机开发与重建

需要 Node.js 22+、JDK 21+、Android SDK 36。Android Studio 可以直接打开 `android` 文件夹。

```powershell
npm ci
npm run dev           # 浏览器验证：http://127.0.0.1:3001
npm test
npm run android:apk   # 编译网页、同步到 Android、生成签名调试 APK
```

脚本优先使用 `JAVA_HOME` 与 `ANDROID_HOME`，否则从用户 `.jdks` 和默认 Android SDK 目录查找。支持不含用户名密码的 HTTP 类型 `HTTPS_PROXY` 环境代理。首次构建需要下载 Maven 依赖；此联网仅用于电脑编译。脚本不会自动接受新的 SDK 许可。

修改网页后运行 `npm run android:sync` 再在 Android Studio 构建。最终 APK 位于 `output/cover-maker-debug.apk`；原始 Gradle 产物位于 `android/app/build/outputs/apk/debug/app-debug.apk`。

命令行 Sharp/SVG 生成与原有服务端 API 仍保留；手机使用 Canvas 本地渲染。二者的字体排版可能存在少量像素差异，手机预览与手机导出使用同一套渲染程序。旧桌面自动编号不会自动迁移到手机。

## 已验证与待验证

已通过 Node 测试（含 IndexedDB 原子保存、并发编号和手动编号冲突）、TypeScript 构建、Android APK 构建。在内置浏览器验证了选图、自定义分类、本地生成、1080×1440 尺寸及刷新后历史读取。

尚未安装到连接的实体手机，因此系统图片选择器、相册保存、系统分享以及不同手机 WebView 的兼容性仍需安装后实测。AVIF 支持取决于手机 WebView；不支持时请转换为 JPG/PNG。TIFF 支持常见格式，复杂或特殊编码图片可能需要先转换。
