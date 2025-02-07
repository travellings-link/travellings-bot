# backup_member_list

此脚本用于从 Travellings API 获取数据输出为 json

## 环境要求

- Python 3.x

## 安装依赖

1. 安装 Python 依赖：
    ```sh
    pip install -r scripts/backup_member_list/requirements.txt
    ```

## 使用说明

1. 运行脚本：(脚本运行位置为项目根目录)
    ```sh
    python scripts/backup_member_list/main.py
    ```

拉取到的文件会输出到 `./tmp/all.json`
