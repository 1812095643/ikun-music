<template>
  <div class="border-b border-neutral-100 dark:border-neutral-800 bg-white dark:bg-black z-10">
    <n-scrollbar ref="scrollbarRef" x-scrollable>
      <div
        class="flex items-center py-4 page-padding"
        style="white-space: nowrap"
        @wheel.prevent="handleWheel"
      >
        <span
          v-for="(category, index) in categories"
          :key="getItemKey(category, index)"
          class="py-1.5 px-4 mr-3 inline-block rounded-[9px] cursor-pointer transition-opacity duration-200 text-sm font-medium bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-primary/5 dark:hover:bg-primary/10 hover:text-primary dark:hover:text-primary"
          :class="[
            animationClass,
            index === 0 ? 'ml-0.5' : '',
            isActive(category) ? 'bg-primary text-white' : ''
          ]"
          :style="getAnimationDelay(index)"
          @click="handleClickCategory(category)"
        >
          {{ getItemLabel(category) }}
        </span>
      </div>
    </n-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { NScrollbar } from 'naive-ui';
import { computed, ref } from 'vue';

import { setAnimationDelay } from '@/utils';

type Category = string | number | { [key: string]: any };

type CategorySelectorProps = {
  categories: Category[];
  modelValue: any;
  labelKey?: string;
  valueKey?: string;
  animationClass?: string;
};

const props = withDefaults(defineProps<CategorySelectorProps>(), {
  labelKey: 'label',
  valueKey: 'value',
  animationClass: ''
});

const emit = defineEmits<{
  'update:modelValue': [value: any];
  change: [value: any];
}>();

const scrollbarRef = ref();

const getItemKey = (item: Category, index: number): string | number => {
  if (typeof item === 'object' && item !== null) {
    return item[props.valueKey] ?? item[props.labelKey] ?? index;
  }
  return item;
};

const getItemLabel = (item: Category): string => {
  if (typeof item === 'object' && item !== null) {
    return item[props.labelKey] ?? String(item);
  }
  return String(item);
};

const getItemValue = (item: Category): any => {
  if (typeof item === 'object' && item !== null) {
    return item[props.valueKey] ?? item;
  }
  return item;
};

const isActive = (item: Category): boolean => {
  const itemValue = getItemValue(item);
  return itemValue === props.modelValue;
};

const getAnimationDelay = computed(() => {
  return (index: number) => setAnimationDelay(index, 30);
});

const handleClickCategory = (item: Category) => {
  const value = getItemValue(item);
  if (value === props.modelValue) return;
  emit('change', value);
};

const handleWheel = (e: WheelEvent) => {
  const scrollbar = scrollbarRef.value;
  if (scrollbar) {
    const delta = e.deltaY || e.detail;
    scrollbar.scrollBy({ left: delta });
  }
};

defineExpose({
  scrollbarRef
});
</script>
