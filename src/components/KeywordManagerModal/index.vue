<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { X, Plus, ShieldAlert } from 'lucide-vue-next'

const visible = defineModel<boolean>('visible', { default: false })

const keywords = ref<string[]>([])
const inputValue = ref('')

const STORAGE_KEY = 'blocklistKeywords'

// 加载关键字
const loadKeywords = async () => {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY)
    if (result[STORAGE_KEY] && Array.isArray(result[STORAGE_KEY])) {
      keywords.value = result[STORAGE_KEY]
    }
  } catch (error) {
    console.error('[KeywordManager] 读取关键字失败', error)
  }
}

// 保存关键字到 Storage
const saveKeywords = async () => {
  try {
    // 必须解构或使用 toRaw 将 Vue Proxy 转为普通数组，否则 chrome.storage 无法正确序列化并会导致静默失败
    await chrome.storage.local.set({ [STORAGE_KEY]: [...keywords.value] })
  } catch (error) {
    console.error('[KeywordManager] 保存关键字失败', error)
  }
}

// 添加关键字
const handleAdd = () => {
  const val = inputValue.value.trim()
  if (!val) return
  
  // 避免重复添加，忽略大小写比较
  const isDuplicate = keywords.value.some(k => k.toLowerCase() === val.toLowerCase())
  if (isDuplicate) {
    inputValue.value = ''
    return
  }

  keywords.value.push(val)
  inputValue.value = ''
  saveKeywords()
}

// 移除关键字
const handleRemove = (index: number) => {
  keywords.value.splice(index, 1)
  saveKeywords()
}

// 监听弹窗打开，重新拉取最新数据
watch(visible, (newVal) => {
  if (newVal) {
    loadKeywords()
  }
})

// 组件销毁时恢复滚动
onUnmounted(() => {
  document.body.style.overflow = ''
})
</script>

<template>
  <transition
    enter-active-class="transition duration-300 ease-out"
    leave-active-class="transition duration-200 ease-in"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div 
      v-if="visible" 
      class="fixed inset-0 z-[99999999] flex items-center justify-center bg-background/60 backdrop-blur-sm"
      @click.self="visible = false"
      @wheel.prevent.stop
      @touchmove.prevent.stop
    >
      <transition
        enter-active-class="transition duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        leave-active-class="transition duration-200 ease-in"
        enter-from-class="opacity-0 scale-95 translate-y-4"
        leave-to-class="opacity-0 scale-95 translate-y-4"
        appear
      >
        <div 
          class="relative w-full max-w-md mx-4 bg-popover/95 backdrop-blur-[24px] border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[85vh]"
          @wheel.stop
          @touchmove.stop
        >
          
          <!-- Header -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-border/50">
            <div class="flex items-center gap-2 text-foreground font-semibold">
              <ShieldAlert class="w-5 h-5 text-primary" />
              <h2>屏蔽关键字管理</h2>
            </div>
            <button 
              @click="visible = false"
              class="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer outline-none"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Body -->
          <div class="p-5 flex-1 overflow-y-auto custom-scrollbar overscroll-contain">
            
            <!-- Input Area -->
            <div class="flex gap-2 mb-6">
              <input 
                v-model="inputValue"
                @keyup.enter="handleAdd"
                type="text"
                placeholder="输入要屏蔽的关键字，按回车添加"
                class="flex-1 bg-muted/50 border border-border/80 rounded-xl px-4 py-2 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
              <button 
                @click="handleAdd"
                class="flex items-center justify-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-medium text-[14px] rounded-xl hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer outline-none whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="!inputValue.trim()"
              >
                <Plus class="w-4 h-4" />
                <span>添加</span>
              </button>
            </div>

            <!-- Keywords List -->
            <div>
              <h3 class="text-[13px] font-medium text-muted-foreground mb-3 px-1">
                已添加的关键字 ({{ keywords.length }})
              </h3>
              
              <div v-if="keywords.length > 0" class="flex flex-wrap gap-2">
                <div 
                  v-for="(keyword, index) in keywords" 
                  :key="index"
                  class="group flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 bg-primary/10 text-primary rounded-lg text-[13px] font-medium border border-primary/10 transition-colors"
                >
                  <span class="max-w-[200px] truncate" :title="keyword">{{ keyword }}</span>
                  <button 
                    @click="handleRemove(index)"
                    class="p-0.5 rounded-md hover:bg-primary/20 text-primary/70 hover:text-primary transition-colors cursor-pointer outline-none"
                    title="删除"
                  >
                    <X class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              
              <div v-else class="py-8 text-center text-muted-foreground text-[14px] flex flex-col items-center gap-2 opacity-60">
                <ShieldAlert class="w-8 h-8 stroke-[1.5]" />
                <p>暂无屏蔽关键字，首页内容将不受影响</p>
              </div>
            </div>

          </div>
        </div>
      </transition>
    </div>
  </transition>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 4px;
}
.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background: var(--color-muted-foreground);
}
</style>
