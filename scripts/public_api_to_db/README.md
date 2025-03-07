# public_api_to_db

此脚本用于从 Travellings API 获取数据并将其插入到 MySQL 数据库中。

## 环境要求

- Python 3.x
- MySQL 8.0 或更高版本

## 安装依赖

1. 安装 Python 依赖：
    ```sh
    pip install -r scripts/public_api_to_db/requirements.txt
    ```

## 使用说明

1. 确保 MySQL 数据库服务器正在运行，并且可以通过以下默认配置连接：
    > 如果你需要使用不同的配置连接，请修改 `scripts/public_api_to_db/config.json` 对应值
    - 主机：`127.0.0.1:3306`
    - 用户：`root`
    - 密码：`root`
    - 端口：`3306`

2. 运行脚本：(脚本运行位置为项目根目录)
    ```sh
    python scripts/public_api_to_db/main.py
    ```

## 操作介绍

### 脚本功能

1. 从 Travellings API 获取数据
2. 连接到 MySQL 数据库，并初始化数据库和表结构
3. 将获取的数据插入到 `webs` 表中。

### 数据库初始化

- 脚本会删除（如果存在）并重新创建 `travellings_bot` 数据库。
- 创建 `webs` 表，包含以下字段：
  - `id`：自增主键
  - `status`：网站状态
  - `name`：网站名称
  - `link`：网站链接
  - `tag`：标签
  - `failedReason`：失败原因
  - `lastStatusRunTime`：上一次检查为 RUN 状态的时间
- 创建 `users` 表，包含以下字段：
  - `id`
  - `user`
  - `token`
  - `role`
  - `lastLogin`

### 数据插入

- 从 API 获取的数据将插入到 `webs` 表中。
- 插入时会指定 `id`，确保每条记录的唯一性。

### 日志输出

- 脚本会记录开始时间和结束时间，并计算运行时间。

## 示例输出

```sh
public_api_to_db script 开始时间：2025-02-06 13:28:19.655907
public_api_to_db script 结束时间：2025-02-06 13:28:20.864674
public_api_to_db script 运行时间：1.21 秒
```
