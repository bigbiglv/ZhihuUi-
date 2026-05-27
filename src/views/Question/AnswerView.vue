<script setup lang="ts">
import { ref } from 'vue'
import { useQuestion } from '@/composables/useQuestion'
import QuestionHeader from '@/views/Question/components/QuestionHeader.vue'
import SingleAnswerView from '@/views/Question/components/SingleAnswerView.vue'
import ImagePreview from '@/components/ImagePreview/index.vue'

const {
  questionInfo,
  singleAnswer,
  isQuestionLoading,
  isSingleAnswerLoading,
  viewAllAnswers,
} = useQuestion()

// 大图预览控制状态
const isPreviewVisible = ref(false)
const previewImageSrc = ref('')

// 捕获子组件富文本内的图片点击，唤起全局图片放大预览
const handlePreviewImage = (url: string) => {
  previewImageSrc.value = url
  isPreviewVisible.value = true
}
</script>

<template>
  <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-8">
    <!-- 问题主头部卡片 -->
    <QuestionHeader
      :question-info="questionInfo"
      :is-question-loading="isQuestionLoading"
      @preview-image="handlePreviewImage"
    />

    <!-- 置顶高亮单回答视图 -->
    <div class="mt-8">
      <transition name="fade" mode="out-in">
        <SingleAnswerView
          :single-answer="singleAnswer"
          :is-single-answer-loading="isSingleAnswerLoading"
          :question-info="questionInfo"
          @view-all="viewAllAnswers"
        />
      </transition>
    </div>

    <!-- 弹窗：大图图片无缝预览遮罩层 -->
    <ImagePreview v-model:visible="isPreviewVisible" :src="previewImageSrc" />
  </main>
</template>

<style scoped>
/* 无需多余样式，完美适配全局 UI */
</style>
