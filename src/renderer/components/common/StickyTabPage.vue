<template>
  <div class="sticky-tab-page h-full w-full transition-colors duration-200">
    <n-scrollbar ref="scrollbarRef" class="h-full" :size="100" @scroll="handleScroll">
      <div class="sticky-tab-content w-full pb-32">
        <!-- No extra page header to unify top padding with Home -->

        <!-- Tabs (sticky on scroll) -->
        <div
          class="sticky-tabs z-10 transition-shadow duration-200"
          :class="isSticky ? 'sticky top-0 sticky-tabs--active' : ''"
        >
          <category-selector
            :model-value="modelValue"
            :categories="categories"
            :label-key="labelKey"
            :value-key="valueKey"
            @change="(val: any) => emit('change', val)"
          />
        </div>

        <!-- Content slot -->
        <div class="page-padding pt-4">
          <slot />
        </div>
      </div>
    </n-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

import CategorySelector from '@/components/common/CategorySelector.vue';

type Category = string | number | { [key: string]: any };
type ScrollTargetOptions = { top?: number; left?: number; behavior?: 'auto' | 'smooth' };

withDefaults(
  defineProps<{
    title: string;
    description?: string;
    modelValue: any;
    categories: Category[];
    labelKey?: string;
    valueKey?: string;
  }>(),
  {
    labelKey: 'label',
    valueKey: 'value'
  }
);

const emit = defineEmits<{
  change: [value: any];
  scroll: [e: any];
}>();

const scrollbarRef = ref();
const headerRef = ref<HTMLElement>();
const isSticky = ref(false);

const handleScroll = (e: any) => {
  if (headerRef.value) {
    const headerBottom = headerRef.value.offsetTop + headerRef.value.offsetHeight;
    isSticky.value = e.target.scrollTop >= headerBottom;
  }
  emit('scroll', e);
};

const scrollTo = (options: ScrollTargetOptions) => {
  scrollbarRef.value?.scrollTo(options);
};

defineExpose({ scrollbarRef, scrollTo });
</script>

<style scoped>
.sticky-tabs {
  background: inherit;
}

.sticky-tabs--active {
  border-bottom: 1px solid var(--qqm-border, rgba(20, 24, 31, 0.08));
}

.sticky-tab-page {
  background: var(--qqm-bg, #f7f8fa);
}
</style>
