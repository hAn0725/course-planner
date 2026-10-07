# 用量与余额

入口：左侧学习空间 → 用量与余额。提醒事项仍常驻。使用现有 Inter/中文系统字体、`--ink`、`--muted`、`--line`、`--paper`、绿色强调色；数字使用等宽数字特性。余额在一个白色面板内按厂商分栏，额度与 Token 各用独立面板，不嵌套装饰卡片。窄屏保留双列余额、切换控件换行、提醒事项下移；图表只绘制实际记录。

余额：DeepSeek 读取官方 GET /user/balance；其他三家使用 Edge 独立配置登录官方控制台，必须完成首次登录。账号密码/验证码由用户输入，不提取、不保存至应用配置。可见登录窗口最多保留十分钟，检测到账户余额后自动关闭。之后使用同一配置后台读取。验证码、登录过期、控制台结构变化都需要重新连接或修复适配，不伪造金额。Qwen 现金余额优先；若控制台仅展示账户可用额度，则明确标注该口径（可能包含授信，不等同现金）。

Codex：使用本机 CLI app-server stdio，仅 initialize / initialized、account/rateLimits/read、account/usage/read；不会创建推理任务或购买额度。账户累计与官方每日记录使用官方口径；所选期间不被每日记录覆盖时总量未知。本机日志包括当前与归档目录，按浏览器时区归组。模型名称未知时保留，不按服务商过滤。累计快照做差、计数重置用最后调用、重复日志/有父会话元数据的分叉历史去重。无父会话信息时无法可靠识别跨会话复制，保留记录，不靠相同 Token 数猜测。

接口：GET /api/usage/overview?range=today|7|30|all&scope=account|local&timezone=Asia%2FShanghai；POST /api/usage/refresh 使用同样的 JSON 字段；POST /api/usage/accounts/qwen|mimo|glm/connect 打开登录窗口。仅允许本机 Host 与同源请求。响应只包含规范化金额、额度、汇总、状态及时间，不含凭据、账号 ID、提示词或原始日志。范围切换不强刷厂商。

页面先返回缓存和刷新状态，各来源完成后独立展示；不会等待最慢平台才显示其他数据。页面可见时每分钟检查，刷新期间每秒读取进度，进度读取不会重新触发上游请求。支持总刷新和单厂商刷新，合并重复请求。

后台浏览器在应用内复用，不在每次刷新后退出，跳过图片、字体和媒体资源。Qwen 直接访问新版费用首页，只信任已知费用控制台 iframe；多个现金账户存在歧义时继续查找唯一的账户可用额度，并明确标注口径。GLM 等待真实余额报告完成，不接受初始页面的默认零值；之后复用官方控制台已观察到的只读报告 GET 请求，失败回到控制台恢复。认证头仅在内存中保存，固定官方地址且禁止跟随重定向。DeepSeek 继续直接使用官方余额接口。

自动刷新失败保留上次值并显示陈旧状态；成功时间与尝试时间精确到秒；null 不转换成 0。厂商账单结算延迟无法由本地刷新消除。应用退出时关闭浏览器和 CLI 子进程。本机 Token 归组复用日期格式器，避免逐条创建格式器和排序所有重复日期。

私有位置：%LOCALAPPDATA%/StudyDesk/accounts/{qwen,mimo,glm} 为浏览器专用配置；其中 session-state.dat 仅保存预设官方站点的登录状态（Cookie、localStorage、sessionStorage），Windows 使用当前用户 DPAPI 加密，凭据通过 stdin 传递给系统加密函数，不出现在命令行、日志或页面响应。登录成功后保存，后台恢复并随成功读取更新，已在服务端失效的会话仍需要用户重新登录。usage-cache.json 仅保存规范化余额和 Codex 官方汇总，不保存本机会话正文。数据在仓库外。统计不含费用估算、其他软件用量或课程 AI 调用量。实际控制台登录验证需要用户本人完成。

参考：[Codex app-server](https://learn.chatgpt.com/docs/app-server)、[DeepSeek 余额](https://api-docs.deepseek.com/zh-cn/api/get-user-balance/)、[阿里云余额](https://help.aliyun.com/zh/user-center/developer-reference/api-bssopenapi-2017-12-14-queryaccountbalance)、[Edge 专用配置](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context)。
