# 模型制作与交付

Three.js 是渲染与交互层。精细造型由 Blender 处理，再导出自带网格、PBR 材质、贴图、骨骼和动画的 GLB。这一轮已经使用该流程，不需要付费生成服务。

游戏实际加载 `public/models/` 的 77 个 GLB，共 45,957,248 字节，约 46 MB：4 个英雄、18 个敌军与领主、3 个守卫 / 树灵、40 个防御塔等级与专精版本，以及9个城镇建筑 / 道具和3个居民模型。全部本地载入，首次载入显示进度，失败时提示重试。运行游戏不需要 Blender、模型制作插件或外部账号。

## 基础模型与改造

| 游戏模型 | 基础来源 | 本项目处理 |
| --- | --- | --- |
| 圣盾骑士 | KayKit Knight | 剑盾装备、材质与战斗动画适配 |
| 游林猎手 | KayKit Rogue_Hooded | 弩、兜帽、尺寸与战斗动画适配 |
| 星纹法师 | KayKit Mage | 法杖、材质、施法与战斗动画适配 |
| 森灵祭司 | KayKit Mage | 绿衣配色、鹿角与叶冠、法杖、动画适配 |
| 普通守卫 / 斥候 | KayKit Knight / Rogue_Hooded | 对应武器、比例与动画适配 |
| 黑铁重卫 / 晶甲祭卫 | KayKit Skeleton_Warrior / Skeleton_Mage | 材质与晶甲配件、动画适配 |
| 小鬼 / 掠夺者 / 巫医 | Quaternius Orc / Tribal / Orc_Skull | 比例、材质、动画整理 |
| 攻城兽 / 血誓先锋 | Quaternius Dino / BlueDemon | 尖刺或配件、比例、材质、动画整理 |
| 霜铠巨人 / 霜岩暴君 | Quaternius Yeti | 冰晶配件；领主增加王冠和独立体量 |
| 灰烬无冕王 | Quaternius Demon | 王冠、领主体量、材质与动画整理 |
| 母虫 / 幼虫 / 召唤师 | Quaternius Mushnub_Evolved / Mushnub / Wizard | 比例、材质、动画整理 |
| 幽光灵体 / 夜翼蝠 / 鹰妖 | Quaternius Ghost / Demon / Pigeon（Flying 系列） | 空中尺寸、飞行动画、材质适配 |
| 裂牙奔狼 | Quaternius Animated Animals Vol.2 | 四足骨骼与原作者行走动画；新增眼睛、獠牙、颈毛、攻击、受击和死亡片段 |
| 腐冠古树 / 召唤树灵 | 本项目原创 | 树皮、冠叶、晶核；Blender 材质与对象动画 |
| 八种防御塔 | 本项目原创 | 石砌分层、门窗、支撑、武器、绳索、瓦片、铆钉、符文与等级 / 专精配件；焊接、倒角、材质处理 |

KayKit 和 Quaternius 基础资源均为作者明确提供的 CC0，原始许可与来源见 [THIRD-PARTY.md](THIRD-PARTY.md)。游戏核心代码、关卡和原创塔不因此成为第三方模板。

## 文件与动画

- `art/blender/`：28 个可直接打开的代表性 Blender 工程，包含四名英雄、三种领主、攻城兽、奔狼、树灵、八种一级塔、七种城镇建筑和三种居民。其余塔版本由同一参数化源和脚本重建。
- `art/sources/`：下载的原始模型、作者的原始 Blender 工程与贴图，以及原创模型导出中间件。
- `art/sources/manifest.json` 与 `art/sources/quaternius/manifest.json`：源版本、作者、许可、文件体积与 SHA256。
- `art/model-report-all.json`：每个游戏 GLB 的来源、SHA256、体积、三角面数、骨骼与动画片段。
- `scripts/build-models.py`：可重复运行的 Blender 制作与导出流程。
- `src/assets.js`：GLB 缓存、SkeletonUtils 骨骼克隆、尺寸归一化与 AnimationMixer 播放。

英雄文件保留 Idle / Walk / Attack / Cast / Hit / Death / Victory；怪物保留来源可用的 Idle / Walk / Attack / Hit / Death，新版狼使用24根骨骼和四足 Walking 动画，树灵使用对象动画。居民连接 Walk / Panic 动作。当前战斗连接待机、移动、攻击和英雄施法；导出文件中的受击、死亡与胜利片段保留给进一步演出使用，不宣称所有片段都已触发。

素材采用适合浏览器的风格化模型。各单位尺寸归一化，领主保留更大体量；实例共享只读网格和贴图，骨骼及动画各自独立。退出场景会清理该场景独占的几何体、着色器、动画与特效，基础资产缓存复用。背景景物按材质合并，可破坏障碍保留独立交互对象。

## 重建资源

随项目保留的便携版 Blender 为 4.5.13，从 Blender 官方下载并核对官方 SHA256，位于 `.tools/blender-4.5.13-windows-x64/`。该工具不参与游戏运行，也没有安装到系统目录。

在项目根目录执行：

```powershell
node scripts/export-originals.mjs
& '.\.tools\blender-4.5.13-windows-x64\blender.exe' --background --disable-autoexec --python scripts/build-models.py -- all
& '.\.tools\blender-4.5.13-windows-x64\blender.exe' --background --disable-autoexec --python scripts/build-scene-assets.py
npm run build
```

只重建原创塔和原创怪物可将最后的 `all` 换成 `originals`；只重建采用 CC0 基础的角色和怪物可换成 `characters`。不同阶段分别生成模型报告，不覆盖完整报告的历史来源记录。脚本输出的是游戏可直接加载的 GLB，不是仅供观看的截图。

源文件已随项目提供，不必再次联网下载。需要重新获取资源时，KayKit 使用 `node scripts/acquire-assets.mjs`，Quaternius 使用 `powershell -File scripts/acquire-monsters.ps1`。下载脚本会从作者公开来源取得资源并记录 SHA256；版本更新时需重新核对许可和造型。

## 2026-10-06 场景资源补充

七种城镇建筑采用 KayKit Medieval Hexagon Pack：两类住宅、市场、酒馆、铁匠铺、风车和水井；推车及街灯采用 Kenney Fantasy Town Kit 2.0。三种居民由原有 KayKit Adventurers 改造，移除武器和部分英雄装备，添加农夫草帽，保留独立骨骼、待机、步行和奔跑动作。所有基础资源均为 CC0。

`scripts/build-scene-assets.py` 导出狼、建筑、道具和居民，替换旧狼并追加十二个模型，更新 `art/model-report-all.json` 和 `art/model-report-scene.json`。先运行旧完整流程，再运行此补充流程，即可重建当前77个模型。`art/sources/town/manifest.json` 与 `art/sources/animals/manifest.json` 保存本轮源文件、固定版本、许可及 SHA256。源资源已保留，不需要再次下载。

新版狼来自作者在 OpenGameArt 发布的 Animated Animals Vol.2。Ultimate Animated Animals 下载源当次受到流量限制，没有使用失败返回的网页冒充模型；当前交付确实使用有骨骼和行走动画的源模型。
