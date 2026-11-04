# 胡萝卜剑动态光晕基础框架

源码提交：`881b58003154ffc27525bfe1102118a4b2d0b470`
源码分支：`reconstruct/latest-from-conversation`
备份分支：`backup/weapon-vfx-881b580`

`carrot-vfx-881b580.html` 是单文件离线游戏，下载后用手机浏览器打开。标题页点击“特效预览”（窄屏星形图标）进入独立预览场景。

本轮接入无元素剑的七层渲染框架、呼吸/流动光晕、实际挥砍轨迹、通用命中与融合反馈。预览支持形态、元素配色、攻击、命中、融合、尺寸、旋转、FPS 和活跃特效计数。元素选项仅通用配色预览。未修改战斗伤害逻辑。沿用原图，缺图时程序绘制占位。

割草游戏源码类型检查和生产构建通过，未运行测试、浏览器或试玩。根类型检查包含的历史测试仍引用已删除装备；本轮使用独立的 `tsconfig.blade.json`。`build.log` 为实际构建记录，`manifest.json` 包含文件校验值。按现有内容版本规则清除旧档。没有发布 GitHub Pages，也没有修改荒岛游戏或提交 `.agents/`。

ZIP 是当前源码快照；bundle 是源码分支历史备份，可用 `git clone carrot-history-881b580.bundle carrot-game` 恢复。
