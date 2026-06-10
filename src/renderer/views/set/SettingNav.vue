<template>
  <div class="setting-nav-surface w-32 h-full flex-shrink-0">
    <div
      v-for="section in sections"
      :key="section.id"
      class="px-4 py-2.5 cursor-pointer text-sm transition-colors duration-200 border-l-2"
      :class="[
        currentSection === section.id
          ? 'setting-nav-active text-primary font-medium'
          : 'setting-nav-idle text-neutral-600 dark:text-neutral-400 border-transparent'
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

<style scoped>
.setting-nav-active {
  border-color: var(--qqm-primary, #22c55e) !important;
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 6%, var(--qqm-surface, #ffffff));
}

.setting-nav-idle:hover {
  color: var(--qqm-primary, #22c55e);
  border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 32%, transparent);
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 4%, transparent);
}
</style>
