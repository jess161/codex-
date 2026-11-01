# 源码备份与恢复

当前源码分支是 `reconstruct/latest-from-conversation`。本轮从已确认备份的 `6080d8d`（十二把刀＋三把弓）实现四种普通武器，设计与验证见 [重构说明](gdd/blade-evolution-basic-weapons-v1.2.md) 和 [验收记录](blade-basic-weapons-verification.json)。

[已发布试玩](https://jess161.github.io/codex-/) 与源码分支分别更新。本轮仅备份源码和生成离线游戏，没有更新 Pages 静态发布分支；不能把旧试玩当成本轮新版。历史发布使用 `preview/mobile-20261031`，`version.json` 可用于核对线上源码提交和 HTML 校验值。

本地提交、工作区 ZIP 和 Git bundle 不等于远端备份。需推送源码，再用 `git ls-remote` 或 GitHub 分支页核对远端提交。

```bash
git status
git push origin HEAD:refs/heads/reconstruct/latest-from-conversation
git ls-remote origin refs/heads/reconstruct/latest-from-conversation
```

提交后可生成独立备份：

```bash
mkdir -p /workspace/backups
git archive --format=zip --output=/workspace/backups/blade-source.zip HEAD
git bundle create /workspace/backups/blade-history.bundle --all
git bundle verify /workspace/backups/blade-history.bundle
```

本轮使用 `blade-basic-weapons-<源码短提交>` 文件名前缀，包含源码 ZIP、单文件离线 HTML 和 Git bundle，旁边的 JSON 清单记录提交、远端校验和文件 SHA-256。ZIP 只包含已提交文件；Git bundle 包含本地历史。工作区文件需要下载到自己的设备或其他存储位置，才能在云环境删除后独立恢复。

从 bundle 恢复：

```bash
git clone --branch reconstruct/latest-from-conversation blade-history.bundle recovered-game
cd recovered-game
npm ci
npm run dev -- --port 4173
```

恢复后仍需构建新版才能部署：`npm run build`。`dist/blade-evolution.html` 是自带资源的单文件离线游戏。当前环境浏览器禁用 `file://` 导航，离线验收以本地文件内容在内存中提供页面并禁网完成，未宣称对手机文件管理器做过实测。

旧存档沿用原键和 v8 结构，保留世界进度、道具和战绩，并在读取时转换旧武器。更早的重建、掉落版和三弓版报告保留在 `docs/`，仅记录对应历史版本。
