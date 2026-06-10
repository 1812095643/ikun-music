<template>
  <section class="private-content-section">
    <!-- Section Header -->
    <div class="section-header mb-6 md:mb-8 flex items-end justify-between">
      <div>
        <h2 class="section-title text-neutral-900 dark:text-white">
          {{ title }}
        </h2>
        <div class="mt-1.5 h-1 w-12 rounded-full bg-primary" />
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div
      v-if="loading"
      class="grid grid-cols-1 gap-4 md:gap-5 lg:gap-6 md:grid-cols-2 lg:grid-cols-3"
    >
      <div v-for="i in 3" :key="i" class="skeleton-shimmer rounded-lg" style="aspect-ratio: 16/9" />
    </div>

    <!-- Private Content Grid -->
    <div
      v-else-if="contentList.length > 0"
      class="private-content-grid grid grid-cols-1 gap-6 md:gap-8 lg:gap-10 md:grid-cols-2 lg:grid-cols-3"
    >
      <div
        v-for="content in contentList"
        :key="content.id"
        class="content-item qqm-private-card group relative flex flex-col cursor-pointer overflow-hidden rounded-lg"
        @click="handleContentClick(content)"
      >
        <!-- Cover Image (16:9) -->
        <div class="cover-wrapper relative" style="aspect-ratio: 16/9">
          <img
            :src="getImgUrl(content.picUrl, '640y360')"
            class="h-full w-full object-cover"
            loading="lazy"
            :alt="content.name"
          />

          <!-- Gradient Overlay -->
          <div class="absolute inset-0 bg-black/35" />

          <!-- Exclusive Badge -->
          <div
            class="exclusive-badge absolute top-4 left-4 flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white"
          >
            <i class="iconfont icon-vip text-sm" />
            <span>独家</span>
          </div>
        </div>

        <!-- Content Info -->
        <div class="content-info p-4 md:p-6">
          <h3
            class="content-name line-clamp-2 text-base md:text-lg font-bold leading-tight text-neutral-800 dark:text-neutral-100 transition-colors duration-200 group-hover:text-primary dark:group-hover:text-white"
          >
            {{ content.name }}
          </h3>
          <p
            v-if="content.copywriter"
            class="copywriter mt-2 line-clamp-2 text-xs md:text-sm text-neutral-500 dark:text-neutral-400"
          >
            {{ content.copywriter }}
          </p>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else
      class="empty-state flex flex-col items-center justify-center py-20 text-neutral-400"
    >
      <i class="iconfont icon-empty text-6xl mb-4 opacity-30" />
      <p>暂无独家内容</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { getPrivateContent } from '@/api/home';
import { getImgUrl } from '@/utils';

defineProps<{
  title: string;
}>();

const router = useRouter();
const contentList = ref<any[]>([]);
const loading = ref(true);

const fetchPrivateContent = async () => {
  try {
    const { data } = await getPrivateContent();
    if (data.code === 200 && data.result) {
      contentList.value = data.result;
    }
  } catch (error) {
    console.error('Failed to fetch private content:', error);
  } finally {
    loading.value = false;
  }
};

const handleContentClick = (content: any) => {
  // 根据内容类型跳转
  if (content.type === 'video' && content.id) {
    router.push(`/mv?id=${content.id}`);
  }
};

onMounted(() => {
  fetchPrivateContent();
});
</script>

<style scoped>
/* 网格 */
.private-content-grid {
  grid-auto-rows: auto;
}

.cover-wrapper {
  overflow: hidden;
  will-change: transform;
}

.qqm-private-card {
  border: 1px solid var(--qqm-border);
  background: var(--qqm-surface-2, var(--qqm-surface));
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.qqm-private-card:hover {
  border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 22%, var(--qqm-border));
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 5%, var(--qqm-surface));
}
</style>
