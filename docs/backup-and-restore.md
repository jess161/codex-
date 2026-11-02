# 源码备份与恢复

当前源码分支为 `reconstruct/latest-from-conversation`。本轮基于 `770caee81566f8e68db42bd7f5cd060d48a4b10a`，为胡萝卜加入电纹叶柄、毒液刀身、火焰根尖的分区材质与挥砍／命中／地面效果。三次实际图片生成的原图、提示词和注册图层保留在 `art/carrot-elements/`。按玩家选择，冰只准备素材，不改变电火毒商店与玩法。设计见 [分区外观 v2.7](gdd/blade-evolution-carrot-elements-v2.7.md)。未运行测试、试玩、浏览器或独立类型检查。

[手机试玩](https://jess161.github.io/codex-/) 使用独立发布分支 `preview/mobile-20261031`。按玩家已明确提出的手机浏览器试玩需求继续更新；线上版本以 `version.json` 的源码提交和文件哈希为准。

远端备份：

```bash
git push origin HEAD:refs/heads/reconstruct/latest-from-conversation
git ls-remote origin refs/heads/reconstruct/latest-from-conversation
```

工作区备份使用 `blade-carrot-elements-<源码短提交>` 前缀，包含源码 ZIP、单文件游戏 HTML、完整 Git 历史 bundle 和 SHA-256 清单。文件另存到自己的设备后，可以在环境删除后恢复。

恢复完整历史：

```bash
git clone --branch reconstruct/latest-from-conversation blade-history.bundle recovered-game
cd recovered-game
npm ci
npm run dev -- --port 4173
```

本轮只使用 `node scripts/standalone.mjs --blade-only` 资源打包生成 `dist/blade-evolution.html`，自带代码和图片。

按照玩家的新要求，游戏更新后直接清除旧存档重开，不再迁移或退款。存储键继续使用 `blade-evolution-save-v1`，结构 v15，另记录构建时生成的割草源码内容指纹。同版本内保存和续玩正常；不同版本的对局、装备、金币、战绩与设置直接重置。荒岛游戏的存档独立。
