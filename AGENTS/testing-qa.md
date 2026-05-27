# Testing & QA

## 1. 性能敏感约束 (极其重要)
由于项目作为插件运行于知乎主线程，极易与宿主产生资源争抢，必须避免：
- 高频 `watch` / `deep watch` 滥用
- 大量 `MutationObserver` 监听
- 高频 DOM 查询 (如不断 `querySelector`)
- 高频创建大型深层响应式对象 (`reactive`)
- template 内进行复杂且耗时的计算

涉及推荐流等长列表渲染时，**优先使用**：
- `shallowRef`
- `markRaw` (如 `App.vue` 中的路由组件注册必须使用 `markRaw`)
- 非响应式缓存
- 惰性初始化
