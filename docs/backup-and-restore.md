# 源码提交与恢复

重建功能已保存为本地提交 `687c109`，分支 `reconstruct/latest-from-conversation`。原三选一道具基线为 `3e8eb0e`，仍保留在 `feature/passive-item-groups`。

本地 Git 提交和同一云机器里的压缩包，不等于 GitHub 远端备份。发布环境配置也不等于提交源码。当前没有自动推送或部署。

后续修改可以在仓库目录提交：

```bash
git status
git add src/blade art/reconstructed scripts tests docs README.md package.json
git commit -m "Describe the game changes"
```

需要备份到用户自己的 GitHub 仓库时，手动运行：

```bash
git push origin HEAD:reconstruct/latest-from-conversation
```

推送成功后，再到 GitHub 查看该分支的提交及文件。无需合并到主分支或发布网页，即可保留远端源码。

本次另外在 `/workspace/backups/` 生成源码 ZIP、离线游戏 ZIP 和包含完整 Git 历史的 bundle。它们是工作区文件；本聊天没有可将这些路径转换为公网试玩或附件下载地址的导出工具。

以后可重新生成已提交源码的备份：

```bash
mkdir -p /workspace/backups
git archive --format=zip --output=/workspace/backups/blade-source.zip HEAD
git bundle create /workspace/backups/blade-history.bundle --all
git bundle verify /workspace/backups/blade-history.bundle
```

`git archive` 只打包已提交内容，修改后应先提交再打包。备份文件还需下载到自己的设备或其他存储位置，才能在云环境被删除后独立恢复。

从 bundle 恢复：

```bash
git clone --branch reconstruct/latest-from-conversation blade-history.bundle recovered-game
cd recovered-game
npm ci
npm run dev -- --port 5173
```

本次是按对话需求重新实现的版本，并非恢复旧环境中已经无法读取的逐字源码。
