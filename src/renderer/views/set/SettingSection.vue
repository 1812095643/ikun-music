<template>
  <div :id="id" :ref="setRef" class="mb-7 scroll-mt-20">
    <!-- 分组标题 -->
    <div class="mb-3 px-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
      <slot name="title">{{ title }}</slot>
    </div>

    <!-- 设置项列表容器 -->
    <div class="setting-section-surface rounded-lg overflow-hidden">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type ComponentPublicInstance } from 'vue';

defineOptions({
  name: 'SettingSection'
});

interface Props {
  /** 分组 ID，用于导航定位 */
  id?: string;
  /** 分组标题 */
  title?: string;
}

withDefaults(defineProps<Props>(), {
  id: '',
  title: ''
});

const emit = defineEmits<{
  ref: [el: Element | null];
}>();

// 暴露 ref 给父组件
const setRef = (el: Element | ComponentPublicInstance | null) => {
  emit('ref', el as Element | null);
};
</script>
