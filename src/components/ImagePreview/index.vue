<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { X } from 'lucide-vue-next'

// 定义属性类型
interface Props {
  visible: boolean // 是否显示预览
  src: string // 大图的 URL 地址
}

// 定义自定义事件
interface Emits {
  (e: 'update:visible', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 缩放与平移的响应式状态（基于 transform 3D 渲染，保证 GPU 硬件加速）
const scale = ref(1)
const translateX = ref(0)
const translateY = ref(0)

// 拖拽状态变量
const isDragging = ref(false)
const startX = ref(0)
const startY = ref(0)

// 关闭预览方法
function handleClose() {
  emit('update:visible', false)
}

// 监听滚轮事件，实现以鼠标位置为参考的无级缩放
function handleWheel(e: WheelEvent) {
  e.preventDefault()
  const zoomStep = 0.15 // 无级缩放步长
  let newScale = scale.value + (e.deltaY < 0 ? zoomStep : -zoomStep)
  // 限制缩放比例在 0.4 到 8 倍之间，防止无限放大或缩小
  newScale = Math.max(0.4, Math.min(newScale, 8))
  scale.value = newScale
}

// 鼠标按下：开始拖拽
function handleMouseDown(e: MouseEvent) {
  // 仅限鼠标左键拖拽
  if (e.button !== 0) return
  e.preventDefault()

  isDragging.value = true
  startX.value = e.clientX - translateX.value
  startY.value = e.clientY - translateY.value

  // 注册全局鼠标移动和抬起监听，避免鼠标滑出大图视口后拖拽状态卡死
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
}

// 鼠标移动：实时计算位移值
function handleMouseMove(e: MouseEvent) {
  if (!isDragging.value) return
  translateX.value = e.clientX - startX.value
  translateY.value = e.clientY - startY.value
}

// 鼠标抬起：结束拖拽并安全卸载全局监听
function handleMouseUp() {
  isDragging.value = false
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)
}

// 监听键盘按键，按下 Esc 时关闭预览
function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.visible) {
    close()
  }
}

// 监听 visible 状态，关闭大图时自动重置缩放比例和偏移位置
watch(
  () => props.visible,
  (newVal) => {
    if (!newVal) {
      scale.value = 1
      translateX.value = 0
      translateY.value = 0
      isDragging.value = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  },
)

// 生命周期：在组件挂载时注册全局键盘 Esc 监听事件
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

// 生命周期：在组件销毁时彻底卸载所有监听，保障内存安全
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)
})
</script>

<template>
  <Transition name="fade">
    <div
      v-if="visible"
      class="fixed inset-0 z-999999 flex items-center justify-center bg-black/85 backdrop-blur-xs select-none cursor-default overflow-hidden"
      @click="handleClose"
    >
      <!-- 关闭按钮 -->
      <button
        class="absolute top-6 right-6 z-1000000 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 active:scale-95 transition-all duration-200 cursor-pointer"
        @click.stop="handleClose"
        title="关闭预览"
      >
        <X class="h-6 w-6" />
      </button>

      <!-- 智能微交互手势指南（左上角优雅浮现，视觉质感极其 premium） -->
      <div
        class="absolute top-6 left-6 z-1000000 text-xs text-white/50 bg-black/40 backdrop-blur-xs px-3.5 py-1.5 rounded-full pointer-events-none font-semibold shadow-md"
      >
        <span>🖱️ 滚轮缩放 | ✋ 按住左键拖拽移动</span>
      </div>

      <!-- 图片手势捕获与展示区（正在拖拽时禁用 transition 以保证绝对跟手，正常缩放时启用 transition 保证平滑过渡） -->
      <div
        class="relative max-h-[90vh] max-w-[90vw] select-none"
        :style="{
          transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
          transition: isDragging
            ? 'none'
            : 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }"
        @click.stop
        @wheel="handleWheel"
        @mousedown="handleMouseDown"
      >
        <img
          :src="src"
          alt="大图预览"
          class="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl select-none"
          :class="isDragging ? 'cursor-grabbing' : 'cursor-grab'"
          draggable="false"
        />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* 精精致致的淡入淡出过渡效果 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
