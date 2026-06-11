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
      return 's-btn-primary text-white';
    case 'danger':
      return 's-btn-surface text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200';
    case 'ghost':
      return 's-btn-ghost text-neutral-500 dark:text-neutral-400';
    default:
      return 's-btn-surface text-neutral-700 dark:text-neutral-300';
  }
});
</script>

<style scoped>
.s-btn-primary {
  border-color: var(--qqm-primary, #22c55e);
  background: linear-gradient(
    180deg,
    var(--qqm-primary, #22c55e),
    var(--qqm-primary-strong, #16a34a)
  );
}

.s-btn-primary:hover:not(:disabled) {
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--qqm-primary, #22c55e) 92%, #ffffff),
    var(--qqm-primary-strong, #16a34a)
  );
}

.s-btn-surface {
  border-color: var(--qqm-border, rgba(15, 23, 42, 0.08));
  background: var(--qqm-surface, #ffffff);
}

.s-btn-surface:hover:not(:disabled),
.s-btn-ghost:hover:not(:disabled) {
  color: var(--qqm-primary, #22c55e);
  border-color: color-mix(
    in srgb,
    var(--qqm-primary, #22c55e) 22%,
    var(--qqm-border, rgba(15, 23, 42, 0.08))
  );
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 5%, var(--qqm-surface, #ffffff));
}
</style>
