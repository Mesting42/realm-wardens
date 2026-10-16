# 整屏短暂黑屏排查记录

2026-10-06，Asia/Shanghai。用户确认打开预览时整个显示器短暂变黑，随后恢复，并确认黑屏发生在Windows记录错误的12:59～13:00时间段。

## 实际证据

- Windows 显示适配器：NVIDIA GeForce RTX 3070 Laptop GPU，驱动591.74（系统版本32.0.15.9174，驱动日期2025-12-30）；另有 GameViewer Virtual Display Adapter。虚拟显示适配器的存在只作为环境信息，不据此认定它导致故障。
- Windows 11家庭版，版本10.0.26200。默认HTTP浏览器为Chrome，文件版本157.0.8081.0；Google Update的用户和系统渠道记录均为`x64-dev`，即开发版渠道。浏览器开发版与图形驱动的兼容性应纳入对照检查，这不证明Chrome一定导致该GPU错误。
- 读取最近两天的 System 日志：`nvlddmkm` 事件153共51条。其中2026-10-06的12:13有7条、12:59:17～18有5条、13:00:06～07有6条。事件 XML 明确包含 `Error occurred on GPUID: 100`。
- 2026-10-04和2026-10-05也有同类错误。WER 归档可见一个 `Kernel_141_...` 目录，最后写入时间2026-10-06 00:12:39；受保护的报告内容和转储没有完成分析，不能据其目录认定本次黑屏的具体进程或调用栈。
- 一次黑屏后的 `nvidia-smi` 快照：显存总计8192 MiB、已用1196 MiB、温度53°C。这不是黑屏瞬间的测量，不能排除当时的峰值负载、温度或供电问题。
- 原应用使用 `powerPreference:'high-performance'`，新存档默认高清、丰富特效，主循环按原生刷新率持续绘制。2560×1440 / DPR 1.5 的软件渲染测量为6,498,888个三维像素、495次绘制、211,391个三角形、462个几何体。

原始事件与适配器记录：`test-results/gpu-diagnostic-system.json`。修正前渲染测量：`test-results/gpu-startup-before.json`。

## 当前结论与边界

已证实 NVIDIA 图形驱动记录了 GPU 错误，用户确认黑屏时间与其中11条错误对应。结合整个显示器黑屏后恢复的表现，显卡/图形驱动错误后的恢复是最可能的方向。Microsoft 对 TDR 的说明表明，图形栈重置和桌面恢复可产生整屏闪烁；GPU 错误事件153本身不证明具体 TDR 机制，也不指明是哪个浏览器或应用触发。

尚不能在显卡驱动缺陷、GPU切换、虚拟显示/显示链路兼容性以及硬件稳定性之间确定唯一根因。当前没有把显卡认定为损坏，也没有将本次故障归因于模型文件或最新入口文字修改。应用的启动和持续渲染负载属于可直接降低的触发因素；完成这些修正不等同修复了显卡驱动。

## 应用侧处理

1. WebGL 的 GPU 偏好改为 `default`，交由浏览器选择，保留现有模型和抗锯齿。
2. 新存档默认均衡画质、标准特效；三维像素预算350万，阴影贴图1024×1024。用户仍可手动选择高清，预算650万、阴影2048×2048。
3. 主场景在加载画面内通过 Three.js `compileAsync` 准备着色器；支持 `KHR_parallel_shader_compile` 时使用并行编译。该 API 不能保证底层驱动不出错。
4. 菜单与暂停状态上限30帧，活动战斗上限60帧；后台或图形上下文中断时停止更新与绘制。
5. 原生 WebGL 中断时暂停战斗并显示暂停操作，恢复后重新计算视口，用户可通过真实继续按钮恢复。
6. 提供 `http://127.0.0.1:5175/?safe=1`：当前访问使用均衡画质与标准特效，即使浏览器保存了高清。打开该地址本身不修改存档；正常地址仍尊重原有设置。
7. 浏览器回归在软件渲染的低帧率下发现瞄准提示每次更新会重建取消按钮，导致点击时节点反复被替换。改为仅在目标状态切换时重建提示，降低DOM更新并保持取消操作稳定。
8. 伤害数字与状态标签画布也设像素预算：均衡450万、高清650万、流畅250万。在1920×1080 / DPR 4的明确设备模拟中，旧画布达到18,662,400像素；预算约束独立于三维画布，界面主要按钮和文字仍由HTML/SVG正常绘制。
9. 模型缩略图队列在页面隐藏或WebGL中断时停止绘制，恢复时继续完成尚未生成的预览。

修正后同一尺寸实测3,499,082个三维像素，减少约46%；几何体462、三角形211,391与原场景一致。

## 验证及下一步

`npm run test:graphics` 五组通过。使用明确指定的 SwiftShader 软件渲染器，验证设置、预算、存档保留、WebGL 中断/恢复及后台停止绘制；原生 WebGL 丢失由扩展在软件渲染环境内模拟。这个结果不能证明实体 RTX 3070 的黑屏已消除，也不能替代物理设备故障复现。

实际用户复查时，先关闭此前的游戏预览页面，再打开均衡预览并确认画面质量显示“均衡”。如果仍有整屏黑屏，应记录精确时间和浏览器，核对新增 `nvlddmkm`/Display 事件，并使用稳定版Chrome或现有Edge对照开发版Chrome；随后逐项核对笔记本厂商和 NVIDIA 的驱动支持，以及虚拟显示环境。系统显卡驱动、HDR、显卡选择策略与注册表没有由本项目修改。

## 一手参考

- [Microsoft：WDDM 的超时检测与恢复](https://learn.microsoft.com/en-us/windows-hardware/drivers/display/timeout-detection-and-recovery)：GPU超时恢复、图形栈重置及整屏闪烁。
- [Microsoft：VIDEO_ENGINE_TIMEOUT_DETECTED 0x141](https://learn.microsoft.com/en-us/windows-hardware/drivers/debugger/bug-check-0x141---video-engine-timeout-detected)：说明归档类别所对应的 GPU 引擎超时；目录名不替代转储分析。
- [Three.js：WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)：GPU偏好属于提示，以及异步着色器编译的使用范围。
- [Google：Chrome开发版](https://www.google.com/chrome/dev/)：该渠道用于测试下一代Web平台和新API，按周更新。
- [Microsoft：TDR调试注册表键](https://learn.microsoft.com/en-us/windows-hardware/drivers/display/tdr-registry-keys)：仅用于驱动开发中的针对性测试/调试，终端用户不应修改。没有把延长或关闭TDR作为修复方法。
