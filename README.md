## Travellings Bot

[![wakatime](https://wakatime.com/badge/github/travellings-link/travellings-bot.svg)](https://wakatime.com/badge/github/travellings-link/travellings-bot)  
此项目包含网站巡查功能以及 Telegram 和飞书 Bot。

## 环境

- Node.JS ≥ 18
- MySQL ≥ 8.0
- Redis ≥ 7.0
- pnpm

## 技术栈

- **后端运行时环境**: Node.js
- **框架和库**: Telegraf, Sequelize
- **数据库**: MySQL, Redis
- **网络请求**: Axios
- **浏览器自动化**: Puppeteer
- **第三方服务**: Lark Node.js SDK

## 快速启动

### 生产环境

1. 安装 pnpm：
    ```sh
    npm install -g pnpm
    ```
2. 安装依赖：
    ```sh
    pnpm install
    ```
3. 构建项目：
    ```sh
    pnpm run build
    ```
4. 启动生产服务器：
    ```sh
    pnpm run start
    ```


### 开发环境

#### 事先准备

1. 安装 pnpm：
    ```sh
    npm install -g pnpm
    ```
2. 安装依赖：
    ```sh
    pnpm install
    ```
3. 本地部署 MYSQL （这里假设本地已经安装完毕 docker 环境，包括 docker-cli 工具）：
    ```sh
    docker pull mysql
    docker run --name mysql -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=travellings_bot -p 3306:3306 -d mysql:latest
    ```
4. 使用任意工具链接 MYSQL 服务器，以 [`mycli`](https://www.mycli.net/) 举例
    ```sh
    mycli -u root -p root
    ```
5. 输入以下指令创建数据库，以及初始化数据库数据
    ```sql
    -- 创建数据库
    CREATE DATABASE travellings_bot;
    -- 此步如果提示 (1007, "Can't create database 'travellings_bot'; database exists") 类似的内容
    -- 请使用 DROP DATABASE travellings_bot; 删除可能已存在的数据库

    -- 使用数据库
    USE travellings_bot;

    -- 创建 webs 表
    CREATE TABLE webs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        status VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        link VARCHAR(255) NOT NULL,
        tag VARCHAR(255),
        failedReason VARCHAR(255),
        lastManualCheck DATETIME
    );

    -- 创建 users 表
    CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user VARCHAR(255) NOT NULL,
        token VARCHAR(255) NOT NULL,
        role VARCHAR(255) NOT NULL,
        lastLogin VARCHAR(255)
    );

    -- 创建用户并授予权限
    CREATE USER 'test' IDENTIFIED BY 'test';
    GRANT ALL PRIVILEGES ON travellings_bot.* TO 'test';
    FLUSH PRIVILEGES;

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

#### 以无 Token 模式运行

```sh
pnpm run dev-public
```

启动应用程序后，应用程序将以无 Token 模式运行，直接检查数据库中全部的域名。

#### 以有 Token 模式运行

需要在 `.env` 配置 Bot/开往 API，以及 REDIS 服务器才能启动

启动开发服务器：
```sh
pnpm run dev
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

## 关于贡献

欢迎为项目提出 [Issue](https://github.com/travellings-link/travellings-bot/issues)、[Pull requests
](https://github.com/travellings-link/travellings-bot/pulls)。  
贡献时请参考本项目已有的 Commit History，规范 Commit message。

## 版权

Under [GPL v3](https://www.gnu.org/licenses/gpl-3.0.html)  
2024 © Travellings-link Project. All rights reserved.
