# Cloudflare Pages 公网部署

2026-10-07，Asia/Shanghai。

## 当前发布

- 正式地址：<https://mest-rw.pages.dev/>
- 均衡画质入口：<https://mest-rw.pages.dev/?safe=1>
- Pages 项目：`mest-rw`，生产分支：`main`。
- 本次部署：`ecca36fe-1154-4d9d-a740-e18d54ace36c`。
- 本次版本地址：<https://ecca36fe.mest-rw.pages.dev/>

用户最初选择 `mest.pages.dev`，现场核对该地址已被 MEST2025 会议网站占用。账号中既有的 `mest` 项目实际地址是 `mest-dxp.pages.dev`。用户随后明确新建项目，按 `mest-游戏英文简称.pages.dev` 命名；游戏英文名 REALM WARDENS，采用简称 RW。本次没有修改其他 Pages 项目。

## 发布内容

这是纯静态 Vite / Three.js 游戏，以 Direct Upload 上传 `dist`，没有服务端进程或 Pages Functions。83个构建文件共46,857,496字节，包含77个GLB模型；单文件最大1,058,784字节。Pages 将 `_headers` 作为配置解析，上传日志中的82个普通文件加上单独上传的 `_headers` 对应83个本地文件。

本次构建文件为 `index-3vSjRIyZ.js`、`index-C-TLOaiV.css` 和 `three-CZWtke4O.js`。模型、图标、音效与代码均由本站提供；游戏存档继续保存在当前设备浏览器的localStorage，公网域名与本机/局域网预览属于不同来源，存档相互独立。

`public/_headers` 为带内容哈希的 `/assets/*` 设置一年 immutable 浏览器缓存；固定文件名的 `/models/*` 保留每次验证缓存的策略，以便模型更新生效。HTML 使用 Pages 默认缓存策略。

## 后续更新

在项目根目录执行：

```powershell
& .\Deploy-Cloudflare.ps1 -ProjectName mest-rw
```

或：

```powershell
npm.cmd run deploy:cloudflare -- -ProjectName mest-rw
```

脚本先构建，检查入口、20,000文件及单文件25MiB约束，再使用固定版本 Wrangler 4.148.0 发布 `dist` 到 `main`。现有项目不需要重新创建，每次更新正式网址保持不变。脚本使用本机已有的Wrangler OAuth登录，不在仓库内保存令牌或账号凭据。

只有创建另一个全新项目时才加 `-CreateProject`。新建命令使用 `--force` 明确创建 Pages 项目，防止 Wrangler 4.148.0 在检测到AI代理时自动转交Workers；这个参数在该版本的创建命令中用于绕过转交，不用于后续部署。本次首次普通创建被转交后因缺少Worker入口失败，没有产生部署，随后直接创建Pages成功。

如登录失效，由账号持有人在自己的浏览器完成 `npx.cmd --yes wrangler@4.148.0 login`。不要将令牌写入源码或聊天。

## 公网验证

```powershell
npm.cmd run test:cloudflare
```

脚本访问实际正式HTTPS地址，对比当前本地 `dist/index.html`、全部77个模型和3个JS/CSS资源的SHA256；使用全新触控浏览器经真实菜单进入无尽、购买两座箭塔200→40金币、开始第一波并暂停/恢复。报告为 `test-results/cloudflare-smoke-report.json`，截图为 `cloudflare-mobile-home.png` 与 `cloudflare-mobile-battle.png`。浏览器固定使用Chrome SwiftShader软件渲染，尺寸/触控/UA为设备模拟，不能作为实体手机、Safari或长时间公网游玩的验证。

本次执行结果通过：正式HTTPS主页与本地index一致，77个模型及3个JS/CSS逐个SHA256一致，真实触控购买两箭塔200→40、开始首波与暂停/恢复通过，错误0；两张公网截图已目视核对。详细结果见 `TESTING.md` 顶部。历史局域网delivery清单保留原范围，不会因本次发布自动更新。

参考：[Cloudflare Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)、[Pages响应头](https://developers.cloudflare.com/pages/configuration/headers/)、[Pages上传限制](https://developers.cloudflare.com/pages/platform/limits/)。
