## Travellings Bot

[![wakatime](https://wakatime.com/badge/github/travellings-link/travellings-bot.svg)](https://wakatime.com/badge/github/travellings-link/travellings-bot)  
诶....？这个也要写 README 的吗  
巡查和 Telegram Bot 融为一体  
不代表最终品质

## 环境

- Node.JS ≥ 18
- MySQL ≥ 8.0
- Redis ≥ 7.0
- pnpm

## 技术栈

- Telegraf
- Redis
- Sequelize
- MySQL
- Puppeteer
- Axios
- Lark Node.js SDK

## 配置

将 `.env.example` 重命名为 `.env`，修改之后保存

## 安装 & 启动

- 开发环境：`npm install -g pnpm` & `pnpm i` & `pnpm run dev`
- 生产环境：`npm install -g pnpm` & `pnpm i` & `pnpm run build` & `node dist/app.js`

## Tg Bot 命令

详见 [@TravellingsCN_Bot](https://t.me/TravellingsCN_Bot) /help

```
start - 开始
help - 帮助
version - 版本
query - 查询站点
check - 巡查站点
screenshot - 截图站点
```

## 规范

- 巡查功能放在 `src/methods` 目录
- 组件放在 `src/modules` 目录
- Bot 相关放在 `src/bot` 目录
  - 平台相关的 Bot 功能放在 `src/bot/adapters` 目录
  - Bot 命令实现放在 `src/bot/commands` 目录
  - Bot 中间件实现放在 `src/bot/middlewares` 目录
  - Bot 工具类实现放在 `src/bot/utils` 目录
- 工具（外置函数）放在 `src/utils` 目录
- 构建产物放在 `dist` 目录

PR 请注意规范 Commit message 谢谢喵

## 版权

Under [GPL v3](https://www.gnu.org/licenses/gpl-3.0.html)  
2024 © Travellings-link Project. All rights reserved.
