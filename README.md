# dsh-opencode-quota（5 小时药丸版）

> OpenCode Go 订阅额度状态条：底栏药丸只显示 **5 小时** 窗口的已用百分比；点击展开的详情浮层仍显示 **5 小时 / 每周 / 每月** 三个窗口。

本仓库是 [wang-yzh/dsh-opencode-quota](https://github.com/wang-yzh/dsh-opencode-quota) 的个人变体，仅调整底栏药丸的显示范围，其余逻辑与上游一致。

插件以最小的 `order` 并入 Harness 官方的底栏状态行 `conversation.composer.dock`（官方「会话统计 / Token 用量 / 上下文」药丸所在的那一行），不另开整条状态栏、不遮挡聊天区。

## 效果

- 药丸常驻在官方状态行最左边，只显示 5 小时窗口：`◔ 5小时 3%`
- 百分比为**已用**比例，颜色分级：绿 < 60% / 黄 < 85% / 红 ≥ 85%
- 点击药丸展开官方 StatDialog 风格的浮层，展示 5 小时 / 每周 / 每月 三个窗口的已用 %、剩余 %、重置时间、进度条
- 浮层底部可「刷新」立即重查，或打开 OpenCode Console 查看完整用量
- `Esc` 或点击浮层外部关闭；每 60 秒自动刷新，页面重新可见时立即刷新
- 全部使用宿主主题 token，浅色 / 深色自动适配

## 工作原理

```text
Harness Web 浏览器
   │  同源 GET /opencode-quota/stats（自动带 Harness 登录 cookie）
   ▼
插件 Host 半（Harness Host 进程内）
   │  1. ctx.connection.requestRejection：Host/Origin 栅栏 + 登录校验
   │  2. ctx.credentials.resolve("OPENCODE_GO_API_KEY")
   │  3. GET https://opencode.ai/inference/go/v1/usage
   │     Authorization: Bearer <api-key>
   │  4. 只透出 percent / remainingPercent / resetsAt
   ▼
底栏药丸 + 详情浮层
```

- **API key 只在 Host 进程内使用**，不会下发到浏览器；浏览器只拿到用量百分比。
- 成功结果在 Host 内缓存 30 秒（可配置），并发请求合并为一次上游调用，失败不缓存。
- 上游只返回百分比，不返回金额；不同模型额度金额不同，因此插件不做美元换算，避免误导。

官方接口返回形如：

```json
{
  "usage": {
    "rolling": { "status": "ok", "percent": 3,  "resetsAt": "2026-11-07T12:00:30.000Z" },
    "weekly":  { "status": "ok", "percent": 1,  "resetsAt": "2026-11-09T00:00:00.000Z" },
    "monthly": { "status": "ok", "percent": 0,  "resetsAt": "2026-12-07T06:47:19.000Z" }
  }
}
```

`rolling` 对应 **5 小时滚动窗口**，`weekly` 每周，`monthly` 每月。

## 安装

插件是一个 DSH bundle（`dsh.bundle.patch` + `dsh.client`），没有构建步骤，仓库根目录就是包目录。

从本地目录安装：

```sh
dsh plugin --profile desktop add /path/to/dsh-opencode-quota
dsh plugin --profile web add /path/to/dsh-opencode-quota
```

从 GitHub 安装：

```sh
dsh plugin --profile desktop add github:wang-yzh/dsh-opencode-quota-5h
```

仓库地址：<https://github.com/wang-yzh/dsh-opencode-quota-5h>

也可以在 Harness 的 设置 → 插件 里通过插件管理器安装本地目录 / 仓库地址。

安装后需要**刷新页面**；插件会重新发布浏览器 bundle。

## 配置

在 profile 的 `cordis.patch.yml` 中覆盖 `opencode-quota` 这一行（可选）：

```yaml
- id: opencode-quota
  config:
    # Harness credentials 中保存 API key 的变量名
    credentialRef: OPENCODE_GO_API_KEY

    # OpenCode Go 用量接口
    apiBaseUrl: https://opencode.ai/inference/go/v1

    # Host 成功结果缓存时间（毫秒，最小 1000）
    cacheMs: 30000
```

凭据放在 `~/.dsh/.credentials.yaml`（或通过 设置 → 模型 / 凭据 写入）：

```yaml
OPENCODE_GO_API_KEY: oc_sk_...
```

## 验证

在 DeepSeek Harness `0.2.2-rc.1`（Windows + 官方 desktop profile）上验证：

| 检查项 | 结果 |
| --- | --- |
| Bundle 安装 / 激活 | 通过（`application: applied`） |
| 浏览器端注册 | `conversation.composer.dock`，bundle 正常发布 |
| 数据路由 | `/opencode-quota/stats` 已注册，未登录返回 401 |
| 数据链路 | 真实 API key 实测 200，三个窗口齐全 |
| 渲染位置 / 展开浮层 | 已由使用者在真实页面确认 |

## 目录结构

```text
dsh-opencode-quota/
├── index.js            # Host 半：凭据解析 + 官方用量查询 + 同源路由
├── client.js           # Client 半：底栏药丸 + 展开浮层（React, 无 JSX）
├── cordis.patch.yml    # bundle patch：把 Host 行插入 profile 组合
├── package.json        # dsh.bundle / dsh.client 声明
├── locale/{zh,en}.json # 插件管理器显示名与描述
├── icon.svg
├── LICENSE
└── README.md
```

## 开发

无构建步骤，`index.js` / `client.js` 就是发布产物：

```sh
node --check index.js
node --check client.js
```

修改后重装 bundle（或重启 Harness）让页面加载新代码：

```sh
dsh plugin --profile desktop remove dsh-opencode-quota
dsh plugin --profile desktop add /path/to/dsh-opencode-quota
```

## 已知限制

- 只在带 Web 服务的 profile（`desktop` / `web`）生效；`headless` 不注册路由。
- 官方接口只返回百分比，不返回金额；不提供金额换算。
- 底栏状态行只在**会话输入框下方**出现，新建会话首屏不显示（与官方药丸一致）。
- 上游若只返回部分窗口，插件只渲染已返回的窗口，不会整体报错。

## License

MIT。Host 半的查询与路由结构参考并改编自 [dsh-plugin-opencode-usage](https://github.com/jiekesu967/dsh-plugin-opencode-usage)（MIT，© jiekesu967）；底栏药丸与浮层样式参照 DeepSeek Harness 官方组件（MIT）重写。详见 [LICENSE](./LICENSE)。
