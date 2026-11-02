# 源码备份与恢复

当前源码分支为 `reconstruct/latest-from-conversation`。本轮基于已确认推送的 `4168d407533006a8f7cf9cfb15f798e89056413e`，将商店旧七件装备替换为电、火、毒调料罐头，接入七张图片生成图标、按攻击次数充能的连锁闪电、刷新燃烧与不连爆的死亡爆燃、最多五层毒。设计见 [调料罐头 v2.6](gdd/blade-evolution-seasonings-v2.6.md)，素材记录在 `art/seasonings/`。按玩家要求未运行测试、试玩、浏览器或独立类型检查。

[原网页试玩](https://jess161.github.io/codex-/) 与源码分支分别更新。本轮只备份源码和提供离线游戏，没有更新 Pages；旧网页不能代表本轮调整版。

远端备份：

```bash
git push origin HEAD:refs/heads/reconstruct/latest-from-conversation
git ls-remote origin refs/heads/reconstruct/latest-from-conversation
```

工作区备份使用 `blade-seasonings-<源码短提交>` 前缀，包含源码 ZIP、单文件游戏 HTML、完整 Git 历史 bundle 和 SHA-256 清单。文件另存到自己的设备后，可以在环境删除后恢复。

恢复完整历史：

```bash
git clone --branch reconstruct/latest-from-conversation blade-history.bundle recovered-game
cd recovered-game
npm ci
npm run dev -- --port 4173
```

本轮只使用 `node scripts/standalone.mjs --blade-only` 资源打包生成 `dist/blade-evolution.html`，自带代码和图片。

按照玩家的新要求，游戏更新后直接清除旧存档重开，不再迁移或退款。存储键继续使用 `blade-evolution-save-v1`，结构 v15，另记录构建时生成的割草源码内容指纹。同版本内保存和续玩正常；不同版本的对局、装备、金币、战绩与设置直接重置。荒岛游戏的存档独立。
