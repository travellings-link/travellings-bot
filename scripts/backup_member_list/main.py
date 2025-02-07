import os
import json
import time
from datetime import datetime

import requests


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

    # 将数据写入 api.json 文件
    with open("./tmp/all.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)


if __name__ == "__main__":
    # 记录开始时间
    start_time = time.time()
    print(f"backup_member_list script 开始时间：{datetime.now()}")

    main()

    # 记录结束时间
    end_time = time.time()
    print(f"backup_member_list script 结束时间：{datetime.now()}")

    # 计算并输出时间差
    elapsed_time = end_time - start_time
    print(f"backup_member_list script 运行时间：{elapsed_time:.2f} 秒")
