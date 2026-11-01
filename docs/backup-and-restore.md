# 源码备份与恢复

当前源码分支为 `reconstruct/latest-from-conversation`。本轮从已备份的 `14bd777` 闪电连锁版，新增赤月誓刃、曜金裁决和玄岩巨斧及原创图标。设计见 [三件装备](gdd/blade-evolution-three-relics-v1.8.md)，交付记录见 [本轮说明](blade-three-relics-change-notes.json)。按玩家要求未运行测试或试玩。

[原网页试玩](https://jess161.github.io/codex-/) 与源码分支分别更新。本轮只备份源码和提供离线游戏，没有更新 Pages 发布分支；旧网页不能代表本轮调整版。历史静态发布分支为 `preview/mobile-20261031`。

远端备份需要推送并核对提交：

```bash
git push origin HEAD:refs/heads/reconstruct/latest-from-conversation
git ls-remote origin refs/heads/reconstruct/latest-from-conversation
```

本轮工作区备份使用 `blade-three-relics-<源码短提交>` 前缀，包含源码 ZIP、单文件游戏 HTML、完整 Git 历史 bundle 和 SHA-256 清单。工作区文件需要另存到自己的设备，才能在环境删除后独立恢复。

```bash
mkdir -p /workspace/backups
git archive --format=zip --output=/workspace/backups/blade-source.zip HEAD
git bundle create /workspace/backups/blade-history.bundle --all
git bundle verify /workspace/backups/blade-history.bundle
```

恢复完整历史：

```bash
git clone --branch reconstruct/latest-from-conversation blade-history.bundle recovered-game
cd recovered-game
npm ci
npm run dev -- --port 4173
```

`npm run build` 生成 `dist/blade-evolution.html`，自带代码和图片。离线检查使用实际 HTML 字节在内存页面中提供游戏并禁网；环境浏览器禁用 `file://`，未宣称测试过手机文件管理器。

存储键继续使用 `blade-evolution-save-v1`，新结构 v12。v10/v11 的本局装备、金币、等级、世界与触发状态原样保留，只补入新增装备和血契护盾字段。v9 及更早的补偿沿用旧规则。历史源码和旧验收报告仍保留在 Git 中。
