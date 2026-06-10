<template>
  <div
    class="home-polished-card group relative overflow-hidden transition-colors duration-200"
    :class="[containerClass]"
    @click="$emit('click')"
  >
    <!-- 图片区域 -->
    <div class="home-polished-cover relative aspect-square overflow-hidden mb-2.5">
      <img v-if="image" :src="image" class="h-full w-full object-cover" loading="lazy" />
      <div v-else class="h-full w-full skeleton-shimmer" />

      <!-- 播放按钮遮罩 (Apple Music 风格) -->
      <div
        class="home-polished-overlay absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      >
        <div class="home-polished-play flex h-11 w-11 items-center justify-center rounded-full">
          <slot name="play-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="currentColor"
              class="ml-1 text-white"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </slot>
        </div>
      </div>

      <!-- 右上角额外信息 (例如播放量) -->
      <div
        v-if="$slots.extra"
        class="home-polished-extra absolute top-2 right-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] text-white"
      >
        <slot name="extra" />
      </div>
    </div>

    <!-- 文字区域 -->
    <div class="home-polished-meta px-0 pb-1">
      <h3 v-if="title" class="home-polished-title truncate text-sm font-semibold mb-0.5">
        {{ title }}
      </h3>
      <p v-if="subtitle" class="home-polished-subtitle truncate text-xs">
        {{ subtitle }}
      </p>
    </div>

    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  image?: string;
  title?: string;
  subtitle?: string;
  containerClass?: string;
}>();

defineEmits<{
  (e: 'click'): void;
}>();
</script>
