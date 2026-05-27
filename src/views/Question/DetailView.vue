<script setup lang="ts">
import { ref } from 'vue'
import { useQuestion } from '@/composables/useQuestion'
import QuestionHeader from '@/views/Question/components/QuestionHeader.vue'
import AllAnswersView from '@/views/Question/components/AllAnswersView.vue'
import ImagePreview from '@/components/ImagePreview/index.vue'

// 引入高内聚的详情页业务状态 Composable
const {
  questionInfo,
  answersList,
  isQuestionLoading,
  isAnswersLoading,
  loadMoreAnswers,
  answersSortBy,
  changeAnswersSortBy,
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

    <!-- 全部回答列表流视图 -->
    <div class="mt-8">
      <transition name="fade" mode="out-in">
        <AllAnswersView
          :answers-list="answersList"
          :is-answers-loading="isAnswersLoading"
          :question-info="questionInfo"
          :sort-by="answersSortBy"
          @sort-change="changeAnswersSortBy"
          @load-more="loadMoreAnswers"
        />
      </transition>
    </div>

    <!-- 弹窗：大图图片无缝预览遮罩层 -->
    <ImagePreview v-model:visible="isPreviewVisible" :src="previewImageSrc" />
  </main>
</template>
