<template>
  <div
    class="nav-card group relative overflow-hidden rounded-lg cursor-pointer transition-colors duration-200"
    :class="[aspectClass, colorClasses.bg, active ? colorClasses.activeBg : '']"
    @click="$emit('click')"
  >
    <!-- Content Container -->
    <div class="relative h-full flex flex-col justify-between p-4 md:p-5">
      <!-- Header with Icon and Badge -->
      <div class="flex items-start justify-between">
        <!-- Icon -->
        <div
          class="icon-wrapper flex items-center justify-center h-10 w-10 md:h-11 md:w-11 rounded-[10px] transition-colors duration-200"
          :class="[colorClasses.iconBg, active ? colorClasses.activeIconBg : '']"
        >
          <i
            :class="[
              icon,
              colorClasses.iconColor,
              'text-lg md:text-xl transition-colors duration-200'
            ]"
          ></i>
        </div>

        <!-- Badge (optional) -->
        <div
          v-if="badge"
          class="badge px-2 py-0.5 rounded-[9px] text-[10px] md:text-xs font-semibold"
          :class="colorClasses.badgeBg"
        >
          {{ badge }}
        </div>
      </div>

      <!-- Text Content -->
      <div class="space-y-0.5 md:space-y-1">
        <h3
          class="text-sm md:text-base font-bold tracking-tight line-clamp-1"
          :class="colorClasses.title"
        >
          {{ title }}
        </h3>
        <p class="text-xs md:text-sm line-clamp-1" :class="colorClasses.subtitle">
          {{ subtitle }}
        </p>
      </div>

      <!-- Arrow Indicator -->
      <div
        class="absolute bottom-3 right-3 md:bottom-4 md:right-4 opacity-0 group-hover:opacity-100 transition-colors duration-200"
        :class="colorClasses.arrow"
      >
        <i class="ri-arrow-right-line text-sm md:text-base"></i>
      </div>
    </div>

    <!-- Active Indicator -->
    <div
      v-if="active"
      class="absolute top-3 left-3 h-2 w-2 rounded-[4px]"
      :class="colorClasses.activeDot"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  icon: string;
  title: string;
  subtitle: string;
  color?: string;
  active?: boolean;
  badge?: string | null;
  aspect?: 'square' | 'tall' | 'wide';
}

const props = withDefaults(defineProps<Props>(), {
  color: 'qq',
  active: false,
  badge: null,
  aspect: 'square'
});

defineEmits<{
  (e: 'click'): void;
}>();

const aspectClass = computed(() => {
  switch (props.aspect) {
    case 'tall':
      return 'aspect-[4/5]';
    case 'wide':
      return 'aspect-[16/9]';
    default:
      return 'aspect-square md:aspect-[4/3]';
  }
});

const colorClasses = computed(() => ({
  bg: 'qqm-nav-card-surface',
  activeBg: 'qqm-nav-card-active',
  iconBg: 'qqm-nav-card-icon',
  activeIconBg: 'qqm-nav-card-icon-active',
  iconColor: 'text-primary',
  title: 'text-neutral-900 dark:text-neutral-50',
  subtitle: 'text-neutral-500 dark:text-neutral-400',
  arrow: 'text-primary',
  badgeBg: 'bg-primary text-white',
  activeDot: 'bg-primary'
}));
</script>

<style scoped>
.nav-card {
  position: relative;
}

@keyframes pulse-subtle {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}

.badge {
  animation: pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.qqm-nav-card-surface {
  border: 1px solid var(--qqm-border);
  background: var(--qqm-surface-2, var(--qqm-surface));
}

.nav-card:hover .qqm-nav-card-surface {
  border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 20%, var(--qqm-border));
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 5%, var(--qqm-surface));
}

.qqm-nav-card-active,
.qqm-nav-card-icon,
.qqm-nav-card-icon-active {
  border: 1px solid color-mix(in srgb, var(--qqm-primary, #22c55e) 14%, var(--qqm-border));
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 5%, var(--qqm-surface));
}

.qqm-nav-card-icon-active {
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 8%, var(--qqm-surface));
}
</style>
