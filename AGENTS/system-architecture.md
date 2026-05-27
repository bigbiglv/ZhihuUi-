# System Architecture

## 1. 项目整体运行模型（核心入口地图）

本项目核心运行链路：
```text
知乎原生页面加载
  ↓
inject.ts 注入 MAIN World (核心环境逃逸)
  ↓
拦截知乎原始网络请求数据流
  ↓
proxyFetch / message 事件桥接 (Content Script 通信)
  ↓
Vue App 接管原生 DOM (#root 隐藏与重塑)
  ↓
自研 routeMatcher 监听 SPA 路由切换 (History API Hook)
  ↓
views 渲染目标页面
  ↓
components 构建 UI (Tailwind CSS)
```
AI 在分析需求时，必须首先在脑海中建立以上链路模型，明确当前修改处于链路的哪一层。

## 2. 绝对禁止修改的基础设施区 (No-Touch Zones)

以下基础设施属于项目最底层的核心运行机制。未经明确要求，**绝对禁止**修改或重构以下文件及内部核心逻辑：

- `src/inject.ts` (主世界注入代码)
- `src/utils/proxyFetch.ts` (跨域请求通信协议)
- `src/utils/routeMatcher.ts` (路由匹配引擎)
- `src/App.vue` 中的 DOM 接管逻辑 (`updateReshapeDOMState`)
- `ZHIHU_SPA_URL_CHANGE` 事件派发与监听机制
- `message` 事件桥接协议（双向通信基石）

随意修改上述基建有极高概率导致扩展崩溃或陷入死循环。

## 3. 核心架构与模式约定

### 3.1 架构红线
- **禁止引入 Vue Router**：路由切换强依赖 `popstate` 和定制的 `ZHIHU_SPA_URL_CHANGE` 拦截机制。
- **禁止引入 Axios/Fetch 直连**：所有知乎 API 请求必须走 `proxyFetch` 代理。

## 4. 代码组织与模块拆分

### 4.1 目录职责
- `src/components/`：通用组件应保持使用**组件名同名文件夹**进行管理。内部通常设有一个 `index.vue` 作为对外的入口文件，而其依赖的其他专属子组件应集中存放在该目录下的 `components/` 文件夹中管理。整体保持一个高内聚、有独立结构的组件模块。**绝对禁止将上百行复杂结构堆砌在单一文件中。**
- `src/views/`：页面级视图，大驼峰命名（`XxxView.vue`）。
- `src/composables/`：组合式函数以 `use` 开头，封装响应式状态和 `window` 副作用生命周期。
- `src/utils/`：无副作用纯函数。

### 4.2 组件通信与状态流动边界
- 坚守“单向数据流”（Props Down, Events Up）。
- 针对同一个业务模块（如 `FeedCard` 下极深的微组件），如果 Prop 透传超过两层，**强制要求使用 Vue 的 `provide/inject` 进行上下文共享**。
- 绝对禁止使用 `EventBus`（本项目已承担了与原生页面的通信负担，不应在 Vue 内部再造消息总线）。
