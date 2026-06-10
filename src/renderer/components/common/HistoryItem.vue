<template>
  <div
    class="history-item-row flex items-center gap-3 px-2 py-2 mb-1 rounded-lg cursor-pointer transition-colors duration-200"
    @click="$emit('click')"
  >
    <n-image
      :src="imageUrl"
      class="history-cover-surface w-[56px] h-[56px] flex-shrink-0 rounded-lg"
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
      class="history-delete-button cursor-pointer rounded-lg w-8 h-8 flex flex-shrink-0 justify-center items-center text-neutral-500 dark:text-neutral-400 transition-colors duration-200"
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

<style scoped>
.history-item-row:hover {
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 5%, var(--qqm-surface, #ffffff));
}

.history-delete-button {
  border: 1px solid var(--qqm-border, rgba(15, 23, 42, 0.08));
  background: var(--qqm-surface, #ffffff);
}

.history-delete-button:hover {
  color: var(--qqm-primary, #22c55e);
  border-color: color-mix(
    in srgb,
    var(--qqm-primary, #22c55e) 24%,
    var(--qqm-border, rgba(15, 23, 42, 0.08))
  );
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 6%, var(--qqm-surface, #ffffff));
}
</style>
