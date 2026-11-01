# 源码备份与恢复

当前源码分支为 `reconstruct/latest-from-conversation`。本轮基于已备份的 `4ed060e`，开局收为胡萝卜刀与香蕉弓两种，重画战斗与鉴赏造型，剑与矛退出选择和启动入口。设计见 [果蔬双武器](gdd/blade-evolution-fruit-duo-v2.1.md)，交付记录见 [本轮说明](blade-fruit-duo-change-notes.json)。按玩家要求未运行测试或试玩。

[原网页试玩](https://jess161.github.io/codex-/) 与源码分支分别更新。本轮只备份源码和提供离线游戏，没有更新 Pages；旧网页不能代表本轮调整版。

远端备份：

```bash
git push origin HEAD:refs/heads/reconstruct/latest-from-conversation
git ls-remote origin refs/heads/reconstruct/latest-from-conversation
```

工作区备份使用 `blade-fruit-duo-<源码短提交>` 前缀，包含源码 ZIP、单文件游戏 HTML、完整 Git 历史 bundle 和 SHA-256 清单。文件另存到自己的设备后，可以在环境删除后恢复。

恢复完整历史：

```bash
git clone --branch reconstruct/latest-from-conversation blade-history.bundle recovered-game
cd recovered-game
npm ci
npm run dev -- --port 4173
```

本轮使用 `node node_modules/vite/bin/vite.js build` 与 `node scripts/standalone.mjs` 生成 `dist/blade-evolution.html`，自带代码和图片。

按照玩家的新要求，游戏更新后直接清除旧存档重开，不再迁移或退款。存储键继续使用 `blade-evolution-save-v1`，结构 v14，另记录构建时生成的割草源码内容指纹。同版本内保存和续玩正常；不同版本的对局、装备、金币、战绩与设置直接重置。荒岛游戏的存档独立。
