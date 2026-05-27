<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { RefreshCw, ShieldAlert } from 'lucide-vue-next'
import KeywordManagerModal from '@/components/KeywordManagerModal/index.vue'

const visible = ref(false)
const x = ref(0)
const y = ref(0)
const transformOrigin = ref('top left')
const menuRef = ref<HTMLElement | null>(null)

const showMenu = async (e: MouseEvent) => {
  // 如果按住 shift 键，放行原生右键菜单（关闭劫持）
  if (e.shiftKey) {
    visible.value = false
    return
  }

  // 检查是否点击了输入框或文本域，如果是则放行浏览器默认右键菜单
  const path = e.composedPath()
  const isInput = path.some((el: any) => {
    return (
      el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.isContentEditable
    )
  })

  if (isInput) {
    visible.value = false
    return
  }

  e.preventDefault()

  // 注意：不再先设置 visible.value = true
  // 我们直接使用上一次的尺寸或预估尺寸预先计算好坐标
  // 这样当 visible.value = true 触发渲染时，组件已经在正确的位置，彻底解决“飞入”问题
  const menuWidth = menuRef.value?.offsetWidth || 180
  const menuHeight = menuRef.value?.offsetHeight || 50

  let originY = 'bottom' // 因为默认在光标上方，所以动画缩放基点在底部
  let originX = 'left'   // 默认在光标右侧，基点在左边

  // 需求：优先在右上角弹出（即菜单在光标的右上方，光标在菜单的左下角）
  let posX = e.clientX
  let posY = e.clientY - menuHeight

  // 1. 如果右侧空间不足，则向左翻转（在光标的左上方弹出）
  if (posX + menuWidth > window.innerWidth) {
    posX = e.clientX - menuWidth
    originX = 'right'
  }
  
  // 2. 如果上方空间不足，则向下翻转（在光标的右/左下方弹出）
  if (posY < 0) {
    posY = e.clientY
    originY = 'top'
  }

  // 兜底保护：如果翻转后还是超出边界，强制吸附边缘
  if (posX < 0) {
    posX = 0
    originX = 'left'
  }
  if (posY + menuHeight > window.innerHeight) {
    posY = window.innerHeight - menuHeight
    originY = 'bottom'
  }

  x.value = posX
  y.value = posY
  transformOrigin.value = `${originY} ${originX}`

  // 坐标全部就绪后，再挂载并触发过渡动画
  visible.value = true
}

const hideMenu = () => {
  if (visible.value) {
    visible.value = false
  }
}

const handleRefresh = () => {
  hideMenu()
  window.location.reload()
}

const isKeywordModalVisible = ref(false)

const handleOpenKeywordModal = () => {
  hideMenu()
  isKeywordModalVisible.value = true
}

onMounted(() => {
  window.addEventListener('contextmenu', showMenu)
  window.addEventListener('click', hideMenu)
  window.addEventListener('resize', hideMenu)
  window.addEventListener('scroll', hideMenu, { capture: true })
})

onUnmounted(() => {
  window.removeEventListener('contextmenu', showMenu)
  window.removeEventListener('click', hideMenu)
  window.removeEventListener('resize', hideMenu)
  window.removeEventListener('scroll', hideMenu, { capture: true })
})
</script>

<template>
  <transition 
    enter-active-class="transition duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
    leave-active-class="transition duration-150 ease-out"
    enter-from-class="opacity-0 scale-50"
    leave-to-class="opacity-0 scale-95"
  >
    <div
      v-if="visible"
      ref="menuRef"
      class="fixed z-[99999999] min-w-[180px] rounded-xl py-1.5 bg-popover/95 backdrop-blur-[24px] border border-border shadow-2xl"
      :style="{ 
        left: `${x}px`, 
        top: `${y}px`, 
        transformOrigin: transformOrigin 
      }"
      @click.stop
      @contextmenu.prevent
    >
      <div class="px-1.5 flex flex-col gap-1">
        <button
          @click="handleRefresh"
          class="w-full flex items-center gap-3 px-3 py-2 text-[14px] text-foreground hover:bg-muted hover:text-primary rounded-lg transition-colors cursor-pointer outline-none"
        >
          <RefreshCw class="w-4 h-4" />
          <span>刷新页面</span>
        </button>
        <button
          @click="handleOpenKeywordModal"
          class="w-full flex items-center gap-3 px-3 py-2 text-[14px] text-foreground hover:bg-muted hover:text-primary rounded-lg transition-colors cursor-pointer outline-none"
        >
          <ShieldAlert class="w-4 h-4" />
          <span>屏蔽关键字</span>
        </button>
      </div>
    </div>
  </transition>

  <KeywordManagerModal v-model:visible="isKeywordModalVisible" />
</template>


