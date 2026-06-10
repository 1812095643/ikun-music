<template>
  <div
    class="flex items-center gap-3 px-2 py-2 mb-1 rounded-lg cursor-pointer transition-colors duration-200 hover:bg-primary/5 dark:hover:bg-primary/10"
    @click="$emit('click')"
  >
    <n-image
      :src="imageUrl"
      class="w-[56px] h-[56px] flex-shrink-0 rounded-lg bg-neutral-100 dark:bg-neutral-800"
      lazy
      preview-disabled
    />
    <div class="flex-1 min-w-0">
      <div class="text-base text-neutral-900 dark:text-neutral-100 mb-1">
        <n-ellipsis :line-clamp="1">{{ name }}</n-ellipsis>
      </div>
      <div class="text-sm text-neutral-500 dark:text-neutral-400 truncate">{{ description }}</div>
    </div>
    <div
      v-if="showCount && count"
      class="px-4 text-lg text-center min-w-[60px] text-neutral-600 dark:text-neutral-400 flex-shrink-0"
    >
      {{ count }}
    </div>
    <div
      v-if="showDelete"
      class="cursor-pointer rounded-lg border w-8 h-8 flex flex-shrink-0 justify-center items-center border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-400 hover:text-neutral-700 dark:hover:border-neutral-500 dark:hover:text-neutral-200 transition-colors duration-200"
      @click.stop="$emit('delete')"
    >
      <i class="iconfont icon-close" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  imageUrl: string;
  name: string;
  description: string;
  count?: number;
  showCount?: boolean;
  showDelete?: boolean;
}>();

defineEmits<{
  click: [];
  delete: [];
}>();
</script>
