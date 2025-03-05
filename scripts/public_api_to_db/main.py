import os
import json
import time
from datetime import datetime

import requests
import mysql.connector


def main() -> None:
    # 创建 tmp 目录（如果不存在）
    os.makedirs("./tmp", exist_ok=True)

    # 拉取 https://api.travellings.cn/all

    data = requests.get(
        "https://api.travellings.cn/all",
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36",
            "Referer": "https://list.travellings.cn",
        },
    ).json()
    if data["success"] != True:
        print("API 数据拉取失败，请重新获取")
        return

    # 从 json 文件读取 config
    with open("scripts/public_api_to_db/config.json", "r", encoding="utf-8") as file:
        config_data = json.load(file)

    # 写入 mysql 数据库

    # 连接到 MySQL 数据库
    # 默认连接参数和自述文档一致
    conn = mysql.connector.connect(
        host=config_data["host"],
        user=config_data["user"],
        password=config_data["password"],
        port=config_data["port"],
    )
    cursor = conn.cursor()

    # 初始化数据库
    cursor.execute("DROP DATABASE IF EXISTS travellings_bot;")
    cursor.execute("CREATE DATABASE travellings_bot;")
    # 创建用户并给予权限
    cursor.execute(
        """
        CREATE USER IF NOT EXISTS 'test' IDENTIFIED BY 'test';
        """
    )
    cursor.execute("GRANT ALL PRIVILEGES ON travellings_bot.* TO 'test';")
    cursor.execute("FLUSH PRIVILEGES;")

    cursor.execute("USE travellings_bot;")
    # 创建 webs 表（如果不存在）
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS webs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            status TEXT,
            name TEXT NOT NULL,
            link TEXT NOT NULL,
            tag TEXT,
            failedReason TEXT,
            lastStatusRunTime DATETIME
        );
        """
    )
    # 创建 users 表（如果不存在）
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user TEXT NOT NULL,
            token TEXT NOT NULL,
            role TEXT NOT NULL,
            lastLogin TEXT
        );
        """
    )

    # 插入数据
    for item in data["data"]:
        cursor.execute(
            f"""
            INSERT INTO webs (id, status, name, link, tag, failedReason, lastStatusRunTime) 
            VALUES ({item["id"]}, "{item["status"]}", "{item["name"]}", "{item["url"]}", "{item["tag"]}", "{item["failedReason"]}", "{item["lastStatusRunTime"]}")
        """
        )

    # 提交事务
    conn.commit()

    # 关闭连接
    cursor.close()
    conn.close()


if __name__ == "__main__":
    # 记录开始时间
    start_time = time.time()
    print(f"public_api_to_db script 开始时间：{datetime.now()}")

    main()

    # 记录结束时间
    end_time = time.time()
    print(f"public_api_to_db script 结束时间：{datetime.now()}")

    # 计算并输出时间差
    elapsed_time = end_time - start_time
    print(f"public_api_to_db script 运行时间：{elapsed_time:.2f} 秒")
