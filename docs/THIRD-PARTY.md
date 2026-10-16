# 来源与许可证

游戏逻辑、关卡、防御塔、部分怪物、场景、图标、界面、粒子以及合成声音由本项目自行编写。按用户选择的 Blender + GLB 路线，英雄和部分怪物使用下述作者提供的 CC0 模型作为基础，再制作装备、配件、材质、比例与动画适配。没有使用整套游戏模板或外部游戏逻辑。

怪物出场声与防御建筑攻击声由 `src/sounds.js` 原创PCM生成：声腔共振、谐波、带限噪声和包络组合。音乐及操作提示使用原有原创振荡器旋律。没有采样其他游戏、影片或第三方音效库，游戏运行无需下载外部声音。

| 资产 | 作者与许可 | 在本项目中的用途与记录 |
| --- | --- | --- |
| [KayKit Character Pack — Adventurers](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0) | Kay Lousberg，CC0-1.0 | 骑士、猎手、法师、祭司和守卫的基础骨骼模型；提交版本与每个源文件 SHA256 在 `art/sources/manifest.json`，原许可在 `licenses/KayKit-adventurers-CC0.txt` |
| [KayKit Character Pack — Skeletons](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0) | Kay Lousberg，CC0-1.0 | 黑铁重卫与晶甲祭卫的基础模型；版本与 SHA256 同上，原许可在 `licenses/KayKit-skeletons-CC0.txt` |
| [Quaternius Ultimate Monsters](https://quaternius.com/packs/ultimatemonsters.html) | Quaternius，CC0-1.0 | 作者公开下载目录中的 13 个源 Blender 模型与贴图；源下载标识与 SHA256 在 `art/sources/quaternius/manifest.json`，原许可在 `licenses/Quaternius-Ultimate-Monsters-CC0.txt` |
| [Quaternius Animated Animals Vol.2](https://opengameart.org/content/animated-animales-low-poly) | Quaternius，CC0-1.0 | 作者发布的动画狼；使用原骨骼和 Walking 动作，加入眼睛、獠牙、颈毛及骨骼攻击片段。原始压缩包和 SHA256 在 `art/sources/animals/manifest.json`；许可记录在 `licenses/Quaternius-animals-CC0.txt` |
| [KayKit Medieval Hexagon Pack](https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0) | Kay Lousberg，CC0-1.0 | 七种城镇建筑：两类住宅、酒馆、市场、铁匠铺、风车、水井；固定提交和 SHA256 在 `art/sources/town/manifest.json`，原许可在 `licenses/KayKit-medieval-CC0.txt` |
| [Kenney Fantasy Town Kit 2.0](https://kenney.nl/assets/fantasy-town-kit) | Kenney，CC0-1.0 | 城镇推车和街灯；原始压缩包、所用模型与 SHA256 随项目保留，原许可在 `licenses/Kenney-fantasy-town-CC0.txt` |

三种居民由已取得的 KayKit Adventurers 改造，移除武器和英雄装备，保留独立骨骼及待机、步行、奔跑动作。没有使用该城镇包中的付费角色。

风车动画使用已取得的城镇 GLB 内独立扇叶节点；烟囱烟雾、增强飘雪与居民避障路径由本项目运行时代码生成。居民惊叫采用本项目原创 Web Audio 声腔合成，没有新增外部音频或模型素材。

CC0 资源允许修改与用于游戏；这里主动保留作者信息和原始许可。原资源位于 `art/sources/`，适配后的模型位于 `public/models/`，制作与导出记录在 `art/model-report-all.json`。这些模型不要求登录、付费接口或运行时外部下载。

| 依赖 / 指导 | 用途 | 许可与来源 |
| --- | --- | --- |
| Three.js 0.180.0 | 浏览器 WebGL 渲染、几何体和静态合并工具 | MIT，`node_modules/three/LICENSE`；[官方项目](https://github.com/mrdoob/three.js) |
| Vite 7.3.6 | 开发服务器与生产打包 | MIT，`node_modules/vite/LICENSE.md`；[官方项目](https://github.com/vitejs/vite) |
| Playwright 1.55.1 | 仅用于 Chrome 自动验证 | Apache 2.0，`node_modules/playwright/LICENSE`；[官方项目](https://github.com/microsoft/playwright) |
| frontend-design Skill | 界面信息层级、排版、风格与沙盘构图指导 | Apache 2.0，读取本机 `F:/CodexData/skills/frontend-design/SKILL.md` 和 `LICENSE.txt`；许可副本为本目录 `frontend-design-LICENSE.txt` |

Skill 的指导服从本项目需求。核心系统全部自行实现，未使用任何插件或预制游戏生成工作流。
