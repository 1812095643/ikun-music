<template>
  <transition name="shortcut-toast">
    <div v-if="visible" class="shortcut-toast" :class="`shortcut-toast-${position}`">
      <div class="shortcut-toast-content">
        <div v-if="showIcon" class="shortcut-toast-icon">
          <i :class="icon"></i>
        </div>
        <div class="shortcut-toast-text">{{ text }}</div>
      </div>
    </div>
  </transition>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, ref } from 'vue';

defineProps({
  position: {
    type: String,
    default: 'center',
    validator: (val: string) => ['top', 'center', 'bottom'].includes(val)
  },
  showIcon: {
    type: Boolean,
    default: true
  }
});

const visible = ref(false);
const text = ref('');
const icon = ref('');
let timer: NodeJS.Timeout | null = null;

const show = (message: string, iconName = '') => {
  if (timer) {
    clearTimeout(timer);
  }

  text.value = message;
  icon.value = iconName;
  visible.value = true;

  timer = setTimeout(() => {
    visible.value = false;
    // 在动画结束后触发销毁事件
    setTimeout(() => {
      emit('destroy');
    }, 300);
  }, 1500);
};

// 清理定时器
onBeforeUnmount(() => {
  if (timer) {
    clearTimeout(timer);
  }
});

const emit = defineEmits(['destroy']);

// 暴露方法给父组件
defineExpose({
  show
});
</script>

<style lang="scss" scoped>
.shortcut-toast {
  @apply fixed left-1/2 z-[9999];
  @apply flex items-center justify-center;

  // 位置变体
  &-center {
    @apply top-1/2 -translate-y-1/2;
    .shortcut-toast-content {
      @apply p-2;
    }
  }

  &-top {
    @apply top-20;
  }

  &-bottom {
    @apply bottom-40;
  }

  // 水平居中
  @apply -translate-x-1/2;

  &-content {
    @apply flex flex-col items-center gap-2 p-4 rounded-lg;
    color: var(--qqm-text, #111827);
    border: 1px solid color-mix(in srgb, var(--qqm-border, rgba(15, 23, 42, 0.08)) 84%, transparent);
    background: color-mix(in srgb, var(--qqm-surface, #ffffff) 86%, transparent);
    backdrop-filter: blur(14px) saturate(1.08);
    min-width: 120px;
  }

  &-icon {
    @apply text-3xl;
  }

  &-text {
    @apply text-sm font-medium text-center;
  }
}

.shortcut-toast-enter-active,
.shortcut-toast-leave-active {
  @apply transition-opacity duration-200;
}

.shortcut-toast-enter-from,
.shortcut-toast-leave-to {
  @apply opacity-0 translate-y-1;
}

.shortcut-toast-enter-to,
.shortcut-toast-leave-from {
  @apply opacity-100 translate-y-0;
}
</style>
