# 源码备份与恢复

当前源码分支为 `reconstruct/latest-from-conversation`。本轮从已备份的 `2e324d9` 三件新装备版，收敛为三件紫色背景史诗装备，取消其余商店装备，普通怪金币掉率降为 25%。设计见 [史诗三件](gdd/blade-evolution-epic-trio-v1.9.md)，交付记录见 [本轮说明](blade-epic-trio-change-notes.json)。按玩家要求未运行测试或试玩。

[原网页试玩](https://jess161.github.io/codex-/) 与源码分支分别更新。本轮只备份源码和提供离线游戏，没有更新 Pages 发布分支；旧网页不能代表本轮调整版。历史静态发布分支为 `preview/mobile-20261031`。

远端备份需要推送并核对提交：

```bash
git push origin HEAD:refs/heads/reconstruct/latest-from-conversation
git ls-remote origin refs/heads/reconstruct/latest-from-conversation
```

本轮工作区备份使用 `blade-epic-trio-<源码短提交>` 前缀，包含源码 ZIP、单文件游戏 HTML、完整 Git 历史 bundle 和 SHA-256 清单。工作区文件需要另存到自己的设备，才能在环境删除后独立恢复。

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

本轮使用 `node node_modules/vite/bin/vite.js build` 与 `node scripts/standalone.mjs` 生成 `dist/blade-evolution.html`，自带代码和图片。遵照玩家要求，没有运行测试、浏览器试玩或独立类型检查。

存储键继续使用 `blade-evolution-save-v1`，结构 v13。v10—v12 保留三件史诗装备、等级、世界、金币、战绩和生命比例；移除的持有装备按当时价格一次性退还，并撤销对应累计消费。已出售装备不重复退款，v13 再读不重复迁移。历史源码和报告保留在 Git 中。
