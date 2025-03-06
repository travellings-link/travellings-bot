## Travellings Bot

[![wakatime](https://wakatime.com/badge/github/travellings-link/travellings-bot.svg)](https://wakatime.com/badge/github/travellings-link/travellings-bot)  
此项目包含网站巡查功能以及 Telegram 和飞书 Bot。

## 环境

- Node.JS ≥ 18
- MySQL ≥ 8.0
- pnpm

## 技术栈

- **后端运行时环境**: Node.js
- **框架和库**: Telegraf, Sequelize
- **数据库**: MySQL
- **网络请求**: Axios
- **浏览器自动化**: Puppeteer
- **第三方服务**: Lark Node.js SDK

## 以无数据库模式运行（CLI 模式）

### 事先准备

1. 安装 pnpm：
    ```sh
    npm install -g pnpm
    ```
2. 安装依赖：
    ```sh
    pnpm install
    ```
3. 创建 commit 钩子（如果你无需提交代码，可跳过这步）
    ```sh
    pnpm prepare
    ```

### 进行查询

```sh
pnpm cli https://www.travellings.cn/
```

查询结果将会保存在 `results.json`

结果示例

```json
{
	"results": {
		"https://www.travellings.cn/": {
			"browserCheck": {
				"status": "RUN"
			},
			"axiosCheck": {
				"status": "RUN",
				"failedReason": null
			}
		}
	}
}
```

此模式下：

- 异步查询
- 无需数据库：程序可以在没有数据库连接的情况下运行，适用于快速测试和调试。
- 命令行参数：通过命令行传递参数，指定要执行的操作或要检查的 URL。
- 自动化：适用于自动化脚本和批处理任务，可以集成到 CI/CD 管道中。

支持一次性传入多个网址如：

```sh
pnpm cli https://www.travellings.cn/ https://example.com
```

结果示例

```json
{
	"results": {
		"https://www.travellings.cn/": {
			"browserCheck": {
				"status": "RUN"
			},
			"axiosCheck": {
				"status": "RUN",
				"failedReason": null
			}
		},
		"https://example.com": {
			"browserCheck": {
				"status": "LOST"
			},
			"axiosCheck": {
				"status": "LOST",
				"failedReason": null
			}
		}
	}
}
```

## 以有数据库模式运行

### 事先准备

1. 安装 pnpm：
    ```sh
    npm install -g pnpm
    ```
2. 安装依赖：
    ```sh
    pnpm install
    ```
3. 创建 commit 钩子（如果你无需提交代码，可跳过这步）
    ```sh
    pnpm prepare
    ```
4. 本地部署 MYSQL （这里假设本地已经安装完毕 docker 环境，包括 docker-cli 工具）：
    ```sh
    docker pull mysql
    ```
    ```sh
    docker run --name mysql -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=travellings_bot -p 3306:3306 -d mysql:latest
    ```
5. 初始化数据库

    - 使用脚本自动初始化数据库数据

        - 根据[脚本自述文件](scripts/public_api_to_db/README.md)操作

    - 手动初始化数据库数据

        1. 使用任意工具链接 MYSQL 服务器，以 [`mycli`](https://www.mycli.net/) 举例
            ```sh
            mycli -u root -p root
            ```
        2. 输入以下指令创建数据库，以及初始化数据库数据

            ```sql
            -- 创建数据库
            CREATE DATABASE travellings_bot;
            -- 此步如果提示 (1007, "Can't create database 'travellings_bot'; database exists") 类似的内容
            -- 请使用 DROP DATABASE travellings_bot; 删除可能已存在的数据库

            -- 创建用户并授予权限
            CREATE USER 'test' IDENTIFIED BY 'test';
            GRANT ALL PRIVILEGES ON travellings_bot.* TO 'test';
            FLUSH PRIVILEGES;

            -- 使用数据库
            USE travellings_bot;

            -- 创建 webs 表
            CREATE TABLE webs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                status TEXT,
                name TEXT NOT NULL,
                link TEXT NOT NULL,
                tag TEXT,
                failedReason TEXT,
                lastManualCheck DATETIME
            );

            -- 创建 users 表
            CREATE TABLE users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user TEXT NOT NULL,
                token TEXT NOT NULL,
                role TEXT NOT NULL,
                lastLogin TEXT
            );

            -- 插入测试数据
            INSERT INTO webs (status, name, link, tag, failedReason, lastManualCheck) VALUES
            ('RUN', 'Example Site 1', 'https://www.luochancy.com/', 'example', NULL, NULL),
            ('RUN', 'Example Site 2', 'https://blog.xcnya.cn', 'example', NULL, NULL),
            ('RUN', 'Travellings', 'https://www.travellings.cn', 'example', NULL, NULL);
            ```

6. 复制项目根目录的 `.env.example`，复制后的文件更名为 `.env`，并且修改 `.env` 中这些值

```plaintext
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_NAME=travellings_bot
DB_PASSWORD=root
```

### 以无 Token 模式运行

```sh
pnpm run dev-public
```

启动应用程序后，应用程序将以无 Token 模式运行，直接检查数据库中全部的域名。

### 以有 Token 模式运行

需要在 `.env` 配置 Bot/开往 API

启动开发服务器：

```sh
pnpm run dev
```

### 在生产环境模式运行

需要在 `.env` 配置 Bot/开往 API

进行项目构建

```sh
pnpm build
```

启动生产服务器：

```sh
pnpm run start
```

## Bot 命令

详见 [@TravellingsCN_Bot](https://t.me/TravellingsCN_Bot) /help

```
start - 开始
help - 帮助
version - 版本
query - 查询站点
check - 巡查站点
screenshot - 截图站点
```

## 项目结构

- 巡查功能放在 `src/methods` 目录
- 组件放在 `src/modules` 目录
- Bot 相关放在 `src/bot` 目录
    - 平台相关的 Bot 功能放在 `src/bot/adapters` 目录
    - Bot 命令实现放在 `src/bot/commands` 目录
    - Bot 中间件实现放在 `src/bot/middlewares` 目录
    - Bot 工具类实现放在 `src/bot/utils` 目录
- 工具（外置函数）放在 `src/utils` 目录
- 构建产物放在 `dist` 目录
- 项目相关脚本放在 `scripts` 目录

## 关于贡献

欢迎为项目提出 [Issue](https://github.com/travellings-link/travellings-bot/issues)、[Pull requests ](https://github.com/travellings-link/travellings-bot/pulls)。  
贡献时请参考本项目已有的 Commit History，规范 Commit message。

## 版权

Under [GPL v3](https://www.gnu.org/licenses/gpl-3.0.html)  
2025 © Travellings-link Project. All rights reserved.
