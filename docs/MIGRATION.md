# 数据库迁移指南

# By [AmisKwok](https://github.com/AmisKwok)

# 2026/05/15（更新于 2026/08/03）

## 从旧版本升级

本项目的回收站 / 归档 / 删除采用 **软删除方案**：回收站与软删除均通过
`webs.status` 标记（`ARCHIVED` / `DELETED`）实现，**不新建任何额外表**。

升级只需确保 `webs` 表已包含 `lastUpdated` 字段（用于记录状态最近一次变更时间）：

```sql
ALTER TABLE webs ADD COLUMN lastUpdated DATETIME NULL;
```

> `status` 字段本身已存在，新增的 `ARCHIVED` / `DELETED` 仅是约定取值，无需 DDL 变更。

## 快速迁移

```sql
ALTER TABLE webs ADD COLUMN lastUpdated DATETIME NULL;
```

## 站点 `status` 取值说明（软删除相关）

| status     | 含义                  | 是否被跳转 |
| ---------- | --------------------- | ---------- |
| `RUN`      | 正常运行              | ✅         |
| `LOST`     | 无徽标 / 失去联系     | ❌         |
| `ERROR`    | 访问异常              | ❌         |
| `TIMEOUT`  | 访问超时              | ❌         |
| `WAIT`     | 人工审核异常（锁定）  | ❌         |
| `ARCHIVED` | 已进入回收站（待删）  | ❌         |
| `DELETED`  | 已软删除（默认隐藏）  | ❌         |
| `4xx/5xx`  | 具体 HTTP 错误码      | ❌         |

> `WebModel` 已配置 `defaultScope`，所有常规查询（巡查、对外 API、命令）
> 默认自动排除 `status = 'DELETED'` 的站点，实现软删除的「API 隐藏」效果。
> 回收站相关命令通过 `unscoped()` / `archived` scope 绕过该过滤。

## 验证迁移

迁移完成后，可以运行以下 SQL 验证：

```sql
-- 查看 webs 表结构（应包含 lastUpdated）
DESCRIBE webs;
```
