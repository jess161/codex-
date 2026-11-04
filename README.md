# 胡萝卜剑整套重制备份

源码提交 `5fe9ccc2765c6f1c9a2e27ce8bc81b6af9c5023d`，分支 `reconstruct/latest-from-conversation`。

- `carrot-renditions-5fe9ccc.html` 是单个离线 HTML，已经内嵌图片、脚本和样式，下载后可交给手机浏览器打开，不需要解压。GitHub 原始链接显示源码时，请长按链接选择下载后再打开本地 HTML。
- `source-5fe9ccc.zip` 是该提交全部已跟踪源码，包含原始生成 PNG、提示词、输入设计图、透明素材与来源清单；不包含未跟踪的 `.agents/`。
- `history-5fe9ccc.bundle` 是源码分支完整可达 Git 历史，已通过 Git 备份完整性校验。
- 两张 PNG 是静态美术缩略图与组合图，不是游戏截图。
- `manifest.json` 记录文件大小与 SHA-256。

恢复：

```sh
git clone --branch reconstruct/latest-from-conversation history-5fe9ccc.bundle recovered-game
```

按用户确认的火元素稿重制了基础、火、冰、毒、雷、三灾、巨剑、双刃、剑气九组主要外观，补基础侧背和完整独立光效层。游戏使用实际生成的原生透明素材，不直接抠设定图，不用颜色阈值去底；角色握点与物理根尖统一登记，光晕不扩大判定。玩法、数值、商店、六次三选一、槽位与觉醒规则保持上一版。

本次仅资源打包和静态美术检查。未运行测试、试玩、浏览器或独立类型检查，未改荒岛，未发布 GitHub Pages。新版按既有约定直接清除旧档，旧网页不代表本提交。
