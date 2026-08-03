# 站点回收站 / 归档 / 删除 设计说明

> By [AmisKwok](https://github.com/AmisKwok)
>
> 整理自团队讨论后的结论，用于向后续维护者说明「为什么归档与删除采用
> 软删除方案、以及数据流转逻辑」。

---

## 1. 背景与目标

回收站用于承载长期异常、需要下线的站点。讨论后确定采用 **「软删除 + STATUS 标记」** 方案，核心目标：

- 不真正 `DELETE` 站点数据，保留历史可回溯；
- 复用现有「非 `RUN` 状态即不跳转」机制，新增状态天然不会被 Travellings 跳转；
- 避免把同一份数据存到第二张表带来的冗余与不一致；
- 改动更轻：归档 / 删除只需一次 `UPDATE status`，无需跨表搬数据。

---

## 2. 讨论后结论：统一采用「软删除 + STATUS 标记」

### 2.1 站点 STATUS 语义约定

`webs` 表的 `status` 字段含义：

| STATUS    | 含义                       | 是否被跳转 | 备注                           |
| --------- | -------------------------- | ---------- | ------------------------------ |
| `RUN`     | 正常运行                   | ✅ 是      | 唯一会被跳转的状态             |
| `LOST`    | 巡查发现无徽标 / 失去联系  | ❌ 否      | 由巡查自动标记                 |
| `ERROR`   | 访问异常                   | ❌ 否      | 由巡查自动标记                 |
| `TIMEOUT` | 访问超时                   | ❌ 否      | 由巡查自动标记                 |
| `WAIT`    | 人工审核异常（待人工处理） | ❌ 否      | **锁定状态**：除 `→RUN/ARCHIVED/DELETED` 外不可改 |
| `ARCHIVED`| 已进入回收站（待删除）     | ❌ 否      | 归档时写入                     |
| `DELETED` | 已软删除（对用户/API 隐藏）| ❌ 否      | 删除时写入                     |

> `4xx` / `5xx` 也作为 `status` 存储（表示具体 HTTP 错误码），同样不会跳转。

### 2.2 流程定义

**归档（进入回收站）**

- 巡查 / 人工判定需归档的站点 → `UPDATE webs SET status='ARCHIVED'`。
- 原记录保留在 `webs` 表，不写入任何额外表。

**永久删除（软删除）**

- 在回收站里确认删除的站点 → `UPDATE webs SET status='DELETED'`（或单独 `deleted` 字段）。
- `WebModel` 配置了 `defaultScope`，所有常规查询（巡查、对外 API、命令）默认
  自动排除 `status='DELETED'` 的站点，即为软删除效果。

**恢复**

- `UPDATE webs SET status=<原状态，如 RUN/WAIT>`，站点重新回到正常流转。

---

## 3. 实现要点（已落地）

| 项                 | 方案                                          |
| ------------------ | --------------------------------------------- |
| 归档存储           | 仍在 `webs`，仅改 `status`                    |
| 归档动作           | `site.status='ARCHIVED'; site.save()`         |
| 永久删除           | `UPDATE status='DELETED'`（软删除）           |
| API 可见性         | `defaultScope` 自动排除 `DELETED`             |
| 巡查隔离           | 巡查查询使用 `scope('checkable')` 排除 ARCHIVED/DELETED |
| `WAIT` 状态锁定    | 放宽允许 `WAIT → RUN/ARCHIVED/DELETED`        |

涉及文件：

- `src/modules/sqlModel.ts`：`WebStatus` / `ARCHIVE_STATUS` / `DELETED_STATUS` 常量；
  `defaultScope` + `archived` / `checkable` scope；`beforeUpdate` hook 放宽 WAIT 锁定。
- `src/utils/archiveManager.ts`：`archiveSite` / `restoreArchive` / `deleteArchive` /
  `clearAllArchives` / `runAutoArchive` 均只做 `UPDATE`。
- `src/bot/commands/archives.ts`：归档 / 恢复 / 软删 / 列表 / 清空命令，适配新 manager。
- `src/methods/axios.ts` / `src/methods/browser.ts`：巡查查询加 `scope('checkable')`。

---

## 4. 数据库迁移说明

软删除方案仅依赖 `webs.status` 已有字段，**无需新建任何表**。

若从更早版本升级，仅需确保 `webs` 表存在 `lastUpdated` 字段（用于记录状态变更时间）：

```sql
ALTER TABLE webs ADD COLUMN lastUpdated DATETIME NULL;
```

> `status` 字段本身已存在，新增的 `ARCHIVED` / `DELETED` 仅是约定取值，
> 无需 DDL 变更。
