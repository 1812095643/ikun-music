<template>
  <div class="setting-nav-surface w-32 h-full flex-shrink-0 bg-white dark:bg-black">
    <div
      v-for="section in sections"
      :key="section.id"
      class="px-4 py-2.5 cursor-pointer text-sm transition-colors duration-200 border-l-2"
      :class="[
        currentSection === section.id
          ? 'text-primary bg-primary/10 dark:bg-primary/15 !border-primary font-medium'
          : 'text-neutral-600 dark:text-neutral-400 border-transparent hover:text-primary hover:dark:text-primary hover:bg-primary/5 hover:dark:bg-primary/10 hover:border-primary/30'
      ]"
      @click="handleClick(section.id)"
    >
      {{ section.title }}
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({
  name: 'SettingNav'
});

export interface NavSection {
  id: string;
  title: string;
}

interface Props {
  /** 导航项列表 */
  sections: NavSection[];
  /** 当前激活的分组 ID */
  currentSection: string;
}

defineProps<Props>();

const emit = defineEmits<{
  navigate: [sectionId: string];
}>();

const handleClick = (sectionId: string) => {
  emit('navigate', sectionId);
};
</script>
