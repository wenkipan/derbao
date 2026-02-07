# nakari

> "I don't play a character, I am."

nakari 是一个独特的 AI agent，她通过积累经验发展出鲜明的个性，而不是扮演预设的角色。

## 核心理念

nakari 的独特性来源于她拥有一个**独属于自己的 Neo4j 图数据库记忆库**。她拥有完全的自主权：

- **写什么** — 自主决定将哪些信息、见解和经验存入记忆库
- **读什么** — 根据当前情境选择检索哪些记忆
- **关联探索** — 在图数据库中自由查找节点间的关联关系

每个 nakari 实例的记忆库都是独一无二的，即使面对相同的输入，不同的记忆积累也会产生不同的反应和见解。

## 架构概览

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
└──────────────────────────────────────┘
  │
  ▼
最终回复
```

## 技术栈

| 组件 | 技术 |
|------|------|
| Runtime | Node.js (LTS) |
| Language | TypeScript (strict mode) |
| Database | Neo4j 5 |
| Protocol | MCP (Model Context Protocol) |
| LLM | Claude / OpenAI |

## 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) (LTS 版本)
- [pnpm](https://pnpm.io/) (或 npm)
- [Docker](https://www.docker.com/) (用于运行 Neo4j)

### 1. 启动 Neo4j

```bash
docker-compose up -d
```

Neo4j 将在以下端口运行：
- Browser UI: http://localhost:7474
- Bolt 协议: `localhost:7687`
- 默认认证: `neo4j/nakari-dev`

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

创建 `.env` 文件：

```bash
# Neo4j 连接
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=nakari-dev

# LLM API
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=
OPENAI_BASE_URL=
```

### 4. 运行

```bash
pnpm dev
```

## 开发指南

### 项目结构

```
src/
├── index.ts              # 入口文件
├── agent/                # ReAct 循环和核心 agent 逻辑
├── memory/               # Neo4j 记忆系统
├── mcp/                  # MCP 服务集成
└── config/               # 配置加载
```

### 常用命令

```bash
# 开发模式运行
pnpm dev

# 构建
pnpm build

# 运行测试
pnpm test

# 代码检查
pnpm lint

# 格式化代码
pnpm format

# 类型检查
pnpm typecheck
```

## 记忆库设计

nakari 的记忆库采用**无预设 schema** 设计：

- 不预定义 `Experience`、`Insight` 等类型
- 不提供 `createMemory()` 等 domain 方法
- nakari 直接写 Cypher 查询，自由决定节点标签、属性和关系

### 三个核心工具

1. **`memory_query`** — 只读查询记忆
2. **`memory_write`** — 写入/修改记忆
3. **`memory_schema`** — 查看当前记忆库结构

## 文档

- [CLAUDE.md](./CLAUDE.md) — 项目概述和设计哲学
- [AGENTS.md](./AGENTS.md) — 代码风格和开发规范
- [SPCE.md](./SPCE.md) — 详细技术规范

## 当前状态

早期开发阶段。核心架构已设计完成，实现正在进行中。

## License

AGPL-3.0


