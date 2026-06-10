<template>
  <button
    :disabled="disabled || loading"
    class="inline-flex items-center justify-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 select-none disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-0"
    :class="variantClass"
    @click="$emit('click', $event)"
  >
    <i v-if="loading" class="ri-loader-4-line animate-spin text-sm" />
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';

defineOptions({ name: 'SBtn' });

const props = withDefaults(
  defineProps<{
    variant?: 'default' | 'primary' | 'danger' | 'ghost';
    disabled?: boolean;
    loading?: boolean;
  }>(),
  {
    variant: 'default',
    disabled: false,
    loading: false
  }
);

defineEmits<{ click: [event: MouseEvent] }>();

const variantClass = computed(() => {
  switch (props.variant) {
    case 'primary':
      return 'border-primary bg-primary text-white hover:bg-primary/85';
    case 'danger':
      return 'border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200';
    case 'ghost':
      return 'border-transparent bg-transparent text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800';
    default:
      return 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800';
  }
});
</script>
