# UI Design System

## 1. UI 交互动效 (Micro-animations)
强烈依赖 Tailwind CSS 实现平滑过渡。交互元素（如悬浮按钮、卡片）必须默认具备 `transition` 动效类（如 `transition-all duration-200 hover:bg-accent active:scale-95`），禁止干瘪死板的交互，保持视觉高级感（Premium）。

## 2. Tailwind CSS v4 规范
- **框架版本**：本项目使用 Tailwind CSS v4。AI 生成代码时必须优先使用 Tailwind CSS v4 官方推荐语法。
- **禁止旧语法**：禁止继续生成 Tailwind v3 的旧类名写法，不允许混用 v3 与 v4 风格。新增代码必须统一遵循 v4 规范。修改旧代码时，如正好涉及相关区域，可顺手迁移为 v4 写法，但不要为了迁移制造无意义 diff。
- **渐变类名变更**：
  - **禁止生成**：`bg-gradient-to-*`（如 `bg-gradient-to-r`、`bg-gradient-to-br` 等）
  - **必须使用**：`bg-linear-to-*`（如 `bg-linear-to-r`、`bg-linear-to-br` 等）
- **代码生成要求**：
  - 生成 Tailwind 类名时，必须检查是否存在 v4 新语法。
  - 避免继续输出已被官方标记为 legacy 的类名。
  - 如果 IDE、Linter、Tailwind Language Server 已存在迁移提示，则默认使用最新写法。
