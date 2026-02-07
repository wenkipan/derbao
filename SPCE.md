nakari：个性鲜明，独一无二的 agent

## 设计哲学

> "I don't play a character, I am."

nakari 不做角色扮演。她在一次一次的 ReAct 循环中获取信息，形成自己的见解，
写入自己的记忆库。又从记忆库中汲取经验，对新信息产生独特的反应。

随着时间的沉淀，记忆库独一无二，反映出 nakari 独一无二的特性。

---

## 架构总览

```
用户输入
  │
  ▼
┌──────────────────────────────────────┐
│            ReAct 循环                 │
│                                      │
│  Thought ─► Action ─► Observation    │
│      ▲                     │         │
│      └─────────────────────┘         │
│                                      │
│  Action 可以是:                       │
│   - memory_query / memory_write      │
│   - memory_schema                    │
│   - 其他 MCP tools                   │
│                                      │
│  循环直到 nakari 决定回复为止          │
└──────────────────────────────────────┘
  │
  ▼
最终回复（同时可能已在循环中写入新记忆）
```

### 组件

| 组件 | 职责 |
|------|------|
| **ReAct 循环引擎** | 驱动 Thought → Action → Observation 循环 |
| **LLM 后端** | 提供推理能力（Claude / OpenAI / 其他） |
| **MCP Tools** | nakari 可调用的工具集 |
| **Neo4j 记忆库** | nakari 的长期记忆，无预设 schema |

---

## ReAct 循环设计

### 什么是 ReAct

ReAct = Reasoning + Acting。每一轮循环：

1. **Thought** — LLM 思考当前状态，决定下一步做什么
2. **Action** — 调用一个 tool（或决定直接回复）
3. **Observation** — 获取 tool 的返回结果

循环持续到 LLM 产出最终回复（不再调用 tool）为止。

### 实现方式

调用 LLM API 的 function calling / tool use 能力：
- 将所有可用 tools 的 schema 传入 LLM
- LLM 返回 tool call → 执行 → 将结果喂回 LLM
- LLM 返回文本回复 → 循环结束

不需要手写状态机或规则引擎。LLM 本身就是决策者。

### 循环控制

- **最大轮次**: 设上限（如 10 轮），防止无限循环
- **超时**: 单次 tool 执行设超时限制
- **中断**: 支持 AbortSignal，允许外部取消

---

## 记忆库设计（核心）

### 原则：无预设 schema

**不定义** `MemoryNode`、`Experience`、`Insight` 等固定类型。
不提供 `createExperience()`、`addInsight()` 等 domain method。

nakari 直接操作 Cypher，自主决定：
- 用什么 **label**（节点类型）
- 用什么 **property**（属性名和值）
- 建立什么 **relationship**（关系类型和方向）

数据结构从 nakari 的使用中**自然涌现**，而非被预先规定。

### 为什么选 Neo4j

- **Schema-free** — 节点可以有任意 label 和 property，不需要提前定义表结构
- **关联性** — 图数据库天然适合关联探索（"这个记忆关联了哪些其他记忆？"）
- **Cypher 表达力** — 一条 Cypher 可以完成复杂的匹配+创建+关联操作

### 三个核心 Tools

仅提供三个工具，少而强大：

#### 1. `memory_query` — 只读查询

```
输入: { cypher: string, params: Record<string, unknown> }
输出: { records: Record<string, unknown>[] }
```

执行只读 Cypher（MATCH/RETURN）。nakari 用它检索自己的记忆。

#### 2. `memory_write` — 写入/修改

```
输入: { cypher: string, params: Record<string, unknown> }
输出: { stats: { nodesCreated, relationshipsCreated, propertiesSet, ... } }
```

执行写入 Cypher（CREATE/MERGE/SET/DELETE）。nakari 用它记录新记忆、
更新已有记忆、建立关联、甚至删除记忆（遗忘是自主权的一部分）。

#### 3. `memory_schema` — 审视记忆结构

```
输入: {}
输出: { labels: string[], relationshipTypes: string[], propertyKeys: string[] }
```

查询当前数据库中存在的所有 label、关系类型和属性名。
让 nakari 了解自己记忆库的"形状"，决定是复用已有结构还是创新。

### 为什么不用细粒度工具

如果提供 `createNode(label, props)` + `createRelationship(from, to, type)` 这样的工具，
看似也灵活，但限制了 nakari 每次只能做一件原子操作。

原生 Cypher 允许一条语句完成：匹配已有节点 → 创建新节点 → 建立多个关系 → 更新属性。
这更接近思维的工作方式——一个想法自然地牵连到多个已有记忆。

### Cypher 参数化

所有 Cypher 必须使用参数（`$paramName`），禁止字符串拼接：

```cypher
// 正确
MATCH (u:User {id: $userId}) RETURN u

// 错误 - 绝不允许
MATCH (u:User {id: '${userId}'}) RETURN u
```

Tool 的 input schema 同时接收 cypher 模板和 params 对象。

### 安全与备份

- nakari 拥有完全自主权，包括删除记忆的权利
- **审计日志**: 记录每次 memory_write 执行的 Cypher 和时间戳
- **定期快照**: 在 Neo4j 层面做周期性备份
- 不在应用层限制她能做什么

---

## 运行示例

用户: "我今天心情不太好"

```
Thought: 用户表达了负面情绪。我先看看以前有没有类似的交流。

Action: memory_query
  cypher: MATCH (u:User {id: $userId})-[:HAD_CONVERSATION]->(c)
          WHERE c.emotional_tone = 'negative'
          RETURN c.summary, c.timestamp
          ORDER BY c.timestamp DESC LIMIT 5
  params: { userId: "user-001" }

Observation: 上周有一次，用户也提到压力大，和工作有关。

Thought: 我去看看上次具体聊了什么。

Action: memory_query
  cypher: MATCH (c:Conversation {id: $convId})-[:DISCUSSED]->(t)
          RETURN t.name, t.detail
  params: { convId: "conv-20260201" }

Observation: 上次聊的是项目 deadline 的压力。

Thought: 有了背景，我可以回复了。同时我要记录这次交互。

[生成回复: "上次你也提到过工作压力的事..."]

Action: memory_write
  cypher: MATCH (u:User {id: $userId})
          CREATE (c:Conversation {
            id: $convId, timestamp: datetime(),
            summary: "用户再次表达低落情绪",
            emotional_tone: "negative"
          })
          CREATE (u)-[:HAD_CONVERSATION]->(c)
          WITH c
          MATCH (prev:Conversation {id: $prevConvId})
          CREATE (c)-[:RELATED_TO {reason: "相似的情绪状态"}]->(prev)
  params: { userId: "user-001", convId: "conv-20260207",
            prevConvId: "conv-20260201" }

Observation: { nodesCreated: 1, relationshipsCreated: 2 }
```

注意：`Conversation`、`DISCUSSED`、`emotional_tone`、`RELATED_TO`——
这些 label、关系、属性全部是 nakari 自己决定的，没有代码预先定义。

---

## 系统提示词要点

system prompt 中需要传达的关键信息：

1. 你有一个 Neo4j 数据库，这是你的记忆库
2. 你可以用三个工具自由地读写
3. 不规定你应该创建什么类型的节点——你自己决定
4. 你可以用 `memory_schema` 查看当前记忆库的结构
5. 鼓励在回复前检索相关记忆，在回复后记录有价值的信息

**不要**在 system prompt 中规定数据结构（如"请用 Experience 标签存储经验"）。

---

## 技术栈

- **Runtime**: Node.js (LTS)
- **Language**: TypeScript (strict mode)
- **Database**: Neo4j
- **Protocol**: MCP (Model Context Protocol)
- **LLM**: Claude / OpenAI（通过标准 API 调用）
- **Package manager**: pnpm

---

## 下一步实施计划

1. **搭建项目骨架** — package.json、tsconfig、目录结构
2. **实现三个 memory tools** — 连接 Neo4j，暴露 Cypher 执行能力
3. **实现 ReAct 循环引擎** — LLM API 调用 + tool 执行循环
4. **编写 system prompt** — 不规定 schema，给予自主权
5. **端到端测试** — 跑通一个完整对话，观察 nakari 如何使用记忆库
