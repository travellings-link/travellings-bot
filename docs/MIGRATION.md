# 数据库迁移指南

# By [AmisKwok](https://github.com/AmisKwok)

# 2026/05/15

## 从旧版本升级

本次更新需要对数据库进行以下更改：

### 1. 为 `webs` 表添加 `lastUpdated` 字段

```sql
ALTER TABLE webs ADD COLUMN lastUpdated DATETIME NULL;
```

### 2. 创建 `archives` 表（回收站）

```sql
CREATE TABLE archives (
    id INT AUTO_INCREMENT PRIMARY KEY,
    originalId INT NOT NULL,
    status TEXT,
    name TEXT NOT NULL,
    link TEXT NOT NULL,
    tag TEXT,
    failedReason TEXT,
    lastManualCheck DATETIME,
    lastUpdated DATETIME,
    archivedAt DATETIME NOT NULL,
    archiveReason TEXT NOT NULL
);
```

## 快速迁移

你可以直接运行以下 SQL 语句一次性完成迁移：

```sql
-- 添加 lastUpdated 字段
ALTER TABLE webs ADD COLUMN lastUpdated DATETIME NULL;

-- 创建 archives 表
CREATE TABLE archives (
    id INT AUTO_INCREMENT PRIMARY KEY,
    originalId INT NOT NULL,
    status TEXT,
    name TEXT NOT NULL,
    link TEXT NOT NULL,
    tag TEXT,
    failedReason TEXT,
    lastManualCheck DATETIME,
    lastUpdated DATETIME,
    archivedAt DATETIME NOT NULL,
    archiveReason TEXT NOT NULL
);
```

## 验证迁移

迁移完成后，可以运行以下 SQL 验证：

```sql
-- 查看 webs 表结构
DESCRIBE webs;

-- 查看 archives 表结构
DESCRIBE archives;
```

