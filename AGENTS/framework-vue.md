# Vue Framework

## 1. 代码风格与组件声明规范

- **Props 与 Emits 声明**：分离类型定义。必须优先使用独立的 `interface` 声明组件 Props 和 Emits 类型，禁止在 `defineProps<>` 或 `defineEmits<>` 中直接内联编写复杂的类型推导。**并且要求将所有的 `interface` 统一集中定义在 `<script setup>` 的最顶部，之后再统一调用 `defineProps` 和 `defineEmits`，严禁类型定义与宏调用穿插混排。**
- **Props 默认值定义 (Vue 3.5+)**：本项目基于 Vue 3.5+，**绝对禁止使用 `withDefaults`** 宏。必须利用 Vue 3.5 响应式 Props 解构语法直接赋予默认值。
  ```typescript
  // ✅ 推荐规范：顶部集中声明所有类型，然后紧接宏调用与解构
  interface Props {
    item: FeedItem;
    isCommentsExpanded?: boolean;
  }
  
  interface Emits {
    (e: 'update:isCommentsExpanded', value: boolean): void;
  }

  const { item, isCommentsExpanded = false } = defineProps<Props>();
  const emit = defineEmits<Emits>();
  ```
- **事件命名**：`defineEmits` 派发的自定义事件统一使用 `kebab-case` 短横线命名法（如 `toggle-dark-mode`、`update:isCommentsExpanded`、`not-interested`）。
- **SFC 代码组织顺序**：严格按照 `<script setup lang="ts">` -> `<template>` -> `<style scoped>` 的顺序组织单文件组件。
- **通用组件名与目录规范**：通用组件应以组件名命名文件夹，内部通常使用 `index.vue` 作为入口文件。若有其专属的子组件，需统一放在该目录下的 `components/` 文件夹中管理。
- **模块化类型隔离 (`types.ts`)**：对于拥有独立文件夹结构的组件模块（如 `FeedCard/`），其涉及的**业务数据模型**、**多个子组件之间共享的复合类型**，需统一抽离到该目录下的 `types.ts` 中集中维护，避免散落在各个 `.vue` 文件中。**⚠️ 注意边界**：组件自身独占且极其私有的 `Props` 和 `Emits` 类型，**不适用此规则**。私有的 `Props/Emits` 依然必须遵循前文规范，在 `.vue` 文件的 `<script setup>` 顶部就地集中声明，以保障组件对外接口的高内聚与直观性。
- **事件处理器命名**：在 `<template>` 中绑定的事件处理函数，统一采用 `handle` 前缀命名（如 `handleWheel`、`handleUpvote`），以明确区分业务逻辑与视图交互回调。
