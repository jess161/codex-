# 源码备份与恢复

当前源码分支是 `reconstruct/latest-from-conversation`。本轮基于已备份的 `2865433` 四武器版本，取消旧装备与套装，改为十分钟金币商店与三类通用装备。规则见 [本轮设计](gdd/blade-evolution-economy-v1.3.md)，验证见 [本轮验收](blade-economy-verification.json)。

[此前已发布试玩](https://jess161.github.io/codex-/) 与源码分支独立更新。本轮备份源码、生成离线试玩，没有更新 Pages 静态发布分支；不能把旧网页当成本轮新版。历史网页使用 `preview/mobile-20261031` 静态分支。

源码备份需推送并核对远端提交，本地提交和 ZIP 不等于远端备份：

```bash
git push origin HEAD:refs/heads/reconstruct/latest-from-conversation
git ls-remote origin refs/heads/reconstruct/latest-from-conversation
```

工作区备份使用 `blade-economy-<源码短提交>` 前缀：源码 ZIP、单文件游戏 HTML、完整 Git 历史 bundle 和 SHA-256 清单。它们应下载到自己的设备，才能在云环境删除后独立恢复。

```bash
mkdir -p /workspace/backups
git archive --format=zip --output=/workspace/backups/blade-source.zip HEAD
git bundle create /workspace/backups/blade-history.bundle --all
git bundle verify /workspace/backups/blade-history.bundle
```

从 bundle 恢复：

```bash
git clone --branch reconstruct/latest-from-conversation blade-history.bundle recovered-game
cd recovered-game
npm ci
npm run dev -- --port 4173
```

构建命令 `npm run build` 生成 `dist/blade-evolution.html` 单文件离线游戏。当前浏览器禁用 `file://`，离线验收以实际 HTML 字节在内存页面提供并关闭网络完成，未宣称对手机文件管理器做过实测。

游戏沿用存储键，新数据为 v9；读取旧版本时，已持有旧装备折算金币，旧地面装备转换为原地金币，旧套装清除，战绩和等级保留。转换只执行一次。旧版本源码仍可从 Git 历史中恢复，已有的历史报告不会被改成新版验收结论。
