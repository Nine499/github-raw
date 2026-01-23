# GitHub Raw Proxy - Agent 开发指南

## 项目概述
这是一个基于 Vercel 的 GitHub 文件代理服务，专门为新手设计，代码结构清晰、注释详细。

**核心功能**：
- 令牌验证
- 速度限制
- 智能缓存
- 安全验证

## 开发命令

```bash
# 本地开发
npm run dev

# 代码检查
npm run lint

# 自动修复代码问题
npm run lint:fix

# 部署到生产环境
npm run deploy

# 查看日志
npm run logs
```

## 测试说明
目前项目无测试框架。如需添加测试，建议使用 Jest 或 Vitest。

添加测试步骤：
1. 安装测试框架：`npm install -D jest` 或 `npm install -D vitest`
2. 在 package.json 添加测试脚本：`"test": "jest"` 或 `"test": "vitest"`
3. 创建 `__tests__/` 目录并编写测试文件
4. 运行单个测试：`npm test -- --testNamePattern="测试名称"`
5. 运行单个测试文件：`npm test -- path/to/test.spec.js`

## 代码结构 (7 个部分)

代码按逻辑分为 7 个部分，每个部分都有清晰的分隔注释：

1. **基础配置** - 所有常量和配置项
2. **工具函数** - 纯函数，无副作用
3. **核心类** - SimpleCache 和 RateLimiter
4. **GitHub API 调用** - fetchFromGitHub 函数
5. **响应处理** - 辅助函数
6. **主处理函数** - handler 函数（入口）
7. **导出** - 测试用的导出

## 代码风格规范

### 基础格式
- **缩进**: 2 空格 (ESLint 强制)
- **引号**: 双引号
- **分号**: 必须使用
- **换行符**: Unix 风格 (\n)
- **文件编码**: UTF-8

### 变量声明
- **禁止使用 `var`**: 一律使用 `let` 或 `const`
- **优先使用 `const`**: 除非需要重新赋值才用 `let`
- **比较运算**: 必须使用 `===` 和 `!==`，禁止 `==` 和 `!=`

### 命名约定
- **常量**: UPPER_SNAKE_CASE (如 DEBUG_MODE, GITHUB_BASE_URL)
- **类名**: PascalCase (如 RateLimiter, SimpleCache)
- **函数名**: camelCase (如 parseRequestParams, validateToken)
- **变量名**: camelCase (如 userToken, githubPath)
- **私有方法**: 以下划线开头 (可选)

### 注释风格
- **文件头部**: 使用 JSDoc 格式，包含功能描述、工作流程、使用方法
- **函数/方法**: 必须使用 JSDoc，包含 `@param` 和 `@returns`
- **分区分隔**: 使用 `// ============================================` 标记每个部分
- **步骤注释**: 主函数中使用 `// 步骤 X:` 标记处理流程
- **日志消息**: 使用中文，带 emoji 前缀 (✅ ❌ ⚠️ 📥 🗑️)

### 导入/导出
- **模块系统**: 使用 ES Modules (`export default`, `export`)
- **导入顺序**: Node.js 内置模块 → 第三方模块 → 相对路径
- **导出**: 主 handler 使用 `export default`，工具函数使用 `export`

### 错误处理
- **异步操作**: 使用 try-catch 包装
- **错误分类**: 区分网络错误、超时错误、验证错误
- **错误响应**: 返回统一格式 `{ success: false, error, details }`
- **异常捕获**: 主 handler 函数必须有 try-catch

### 日志记录
- **调试日志**: `DEBUG_MODE` 开关控制
- **日志级别**: `console.info` (成功), `console.warn` (警告), `console.error` (错误)
- **生产环境**: 关闭详细日志，仅记录关键信息
- **开发环境**: 记录详细堆栈和调试信息

### 安全规范
- **路径验证**: 必须验证用户输入路径，防止目录遍历攻击
- **令牌验证**: 所有 API 调用必须通过令牌验证
- **速率限制**: 使用 RateLimiter 防止滥用
- **文件类型**: 使用白名单验证 Content-Type

### 新手友好原则
- **超详细注释**: 每个函数都有中文说明
- **步骤清晰**: 主函数按步骤编号
- **比喻生动**: 使用"快递中转站"、"临时仓库"等比喻
- **示例完整**: 提供完整的使用示例

### 代码组织
- **配置区**: 文件顶部，包含所有常量配置
- **类定义**: 独立的类，每个类负责单一职责
- **工具函数**: 纯函数，无副作用
- **主处理函数**: 作为 `export default`，处理请求流程

### 性能优化
- **缓存策略**: 使用 SimpleCache 缓存 GitHub 响应
- **超时控制**: 所有 fetch 请求设置超时 (10 秒)
- **LRU 淘汰**: 缓存满时自动淘汰最早数据

## 环境变量
- `NODE_ENV`: development 或 production
- `NINE49TOKEN`: 用户访问令牌（必需）
- `GITHUB49TOKEN`: GitHub API 令牌（可选）