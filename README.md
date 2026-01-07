# Travellings 巡查机器人

自动检查 Travellings 成员网站的可访问性和开往链接，并更新状态。

## 功能

- ✅ 从 API 获取所有成员数据
- ✅ 检查网站是否可访问（优先使用 requests，失败时才使用浏览器，提高效率）
- ✅ 检查网站是否包含开往链接（支持 travellings.cn、travellings.link 和 GitHub 仓库链接）
- ✅ **智能检查策略**：优先使用 requests 快速检查，如果通过且找到链接则跳过浏览器检查，节省时间
- ✅ 支持多种链接检测方式：
  - 普通 HTML 链接
  - JavaScript 按钮跳转
  - 中间跳转页面（如 go.php?url=、/go?target= 等，支持实际访问并跟踪跳转）
  - 第二层页面检查（如"更多"页面，仅在浏览器检查后仍未找到链接时使用）
  - 需要浏览器渲染的动态内容（SPA 应用）
  - GitHub 仓库链接（github.com/travellings-link/travellings）
- ✅ **多线程并发检查**：支持多线程同时检查多个网站，大幅提升效率
- ✅ **加强反爬措施**：使用规范的 User-Agent 和完整的请求头，降低被拦截风险
- ✅ 自动更新状态：
  - 异常状态（非 RUN 和 WAIT）如果恢复正常，自动改为 RUN
  - RUN 状态如果检测到异常，改为对应的错误状态（ERROR、TIMEOUT、LOST 等）

## 安装

```bash
pip install -r requirements.txt
playwright install chromium
```

注意：首次安装后需要运行 `playwright install chromium` 来下载浏览器驱动。

## 使用方法

### 基本使用

```bash
python bot.py
```

### 使用 Cookie 认证（更新状态需要）

```bash
python bot.py --cookie "你的_tlogin cookie值"
```

### 限制检查数量（用于测试）

```bash
python bot.py --cookie "你的cookie" --limit 10
```

### 设置并发线程数

```bash
# 使用 10 个并发线程（默认 5）
python bot.py --cookie "你的cookie" --workers 10
```

### 禁用浏览器模式（仅使用 requests）

```bash
python bot.py --cookie "你的cookie" --no-browser
```

### 设置请求延迟（降低服务器压力）

```bash
# 设置API请求之间的延迟为3秒（默认2秒）
python bot.py --cookie "你的cookie" --api-delay 3.0

# 设置检查之间的延迟为1秒（默认0.5秒）
python bot.py --cookie "你的cookie" --check-delay 1.0

# 同时设置两个延迟
python bot.py --cookie "你的cookie" --api-delay 2.5 --check-delay 0.8
```

## 获取 Cookie

1. 打开浏览器，访问 https://list.travellings.cn
2. 登录后，打开开发者工具（F12）
3. 在 Network 标签页中，找到对 `api.travellings.cn` 的请求
4. 查看请求头中的 Cookie，找到 `_tlogin` 的值

## 状态说明

- **RUN**: 网站正常运行且包含开往链接
- **LOST**: 网站可正常访问但没有开往链接
- **ERROR**: 网站无法访问
- **TIMEOUT**: 网站访问超时
- **WAIT**: 等待状态（机器人会跳过）

## 日志

运行日志会同时输出到：
- 控制台
- `bot.log` 文件

## 注意事项

- **智能检查策略**：优先使用 requests 快速检查，如果检查通过且找到链接，则跳过浏览器检查，大幅节省时间
- **User-Agent**：使用规范的 `Mozilla/5.0 (compatible; Travellings Check Bot; +https://www.travellings.cn/docs/qa)`，符合机器人规范
- **反爬措施**：包含完整的请求头（Sec-Fetch-*、DNT、Cache-Control 等），降低被拦截风险
- **浏览器模式**：仅在 requests 检查失败或未找到链接时使用，提高检测准确度，能处理 JavaScript 跳转和动态内容
- **第二层页面检查**：如果首页未找到开往链接，会自动尝试访问"更多"、"links"等第二层页面进行检查
- **中间跳转支持**：支持检测并实际访问中间跳转页面（如 /go?target=...），跟踪跳转过程以找到开往链接
- **GitHub 仓库链接识别**：支持识别指向 GitHub 仓库（github.com/travellings-link/travellings）的链接
- **多线程并发**：默认 5 个并发线程，可通过 `--workers` 参数调整
- **请求延迟控制**：默认启用延迟机制降低服务器压力
  - API 请求之间延迟 2 秒（`--api-delay`）
  - 检查之间延迟 0.5 秒（`--check-delay`）
  - 更新请求会均摊到整个检查过程中，而不是集中发送
- 默认请求超时时间为 30 秒
- 建议在非高峰时段运行，避免对服务器造成压力
- 浏览器模式会消耗更多资源（CPU 和内存），但检测更准确
- 如果不需要检测 JavaScript 跳转，可以使用 `--no-browser` 参数提高速度
- 多线程模式下，API 更新操作会自动加锁，避免并发冲突
- 可以通过调整 `--api-delay` 和 `--check-delay` 参数来平衡检查速度和服务器压力

