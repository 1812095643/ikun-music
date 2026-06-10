<template>
  <div class="donation-section">
    <!-- 头部引导区 -->
    <div class="my-8 text-center">
      <p class="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
        {{ t('donation.description') }}
      </p>
      <div class="mt-4 flex justify-center">
        <n-button type="primary" secondary round @click="toDonateList">
          <template #icon>
            <i class="ri-heart-3-line"></i>
          </template>
          {{ t('donation.toDonateList') }}
        </n-button>
      </div>
    </div>

    <!-- 支付方式卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10 max-w-3xl mx-auto">
      <!-- 支付宝 -->
      <div
        class="pay-card group relative overflow-hidden rounded-lg bg-white/70 dark:bg-neutral-900/60 border border-primary/15 p-6 flex flex-col items-center transition-colors hover:bg-white dark:hover:bg-neutral-900"
      >
        <div
          class="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-xl group-hover:bg-primary/15 transition-colors"
        ></div>
        <img
          :src="alipay"
          alt="Alipay"
          class="w-52 h-52 rounded-lg shadow-sm mb-4 transition-transform duration-300 group-"
        />
        <div class="flex items-center gap-2 text-primary font-bold text-lg">
          <i class="ri-alipay-fill text-2xl"></i>
          {{ t('common.alipay') }}
        </div>
      </div>

      <!-- 微信支付 -->
      <div
        class="pay-card group relative overflow-hidden rounded-lg bg-white/70 dark:bg-neutral-900/60 border border-primary/15 p-6 flex flex-col items-center transition-colors hover:bg-white dark:hover:bg-neutral-900"
      >
        <div
          class="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-xl group-hover:bg-primary/15 transition-colors"
        ></div>
        <img
          :src="wechat"
          alt="WeChat"
          class="w-52 h-52 rounded-lg shadow-sm mb-4 transition-transform duration-300 group-"
        />
        <div class="flex items-center gap-2 text-primary font-bold text-lg">
          <i class="ri-wechat-pay-fill text-2xl"></i>
          {{ t('common.wechat') }}
        </div>
      </div>
    </div>

    <!-- 捐赠者列表 -->
    <div class="donors-list px-4">
      <div class="flex items-center justify-between mb-4 px-1">
        <h4 class="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <i class="ri-user-heart-line text-primary"></i>
          {{ t('donation.title') }}
        </h4>
        <n-button quaternary size="small" :loading="isLoading" @click="fetchDonors">
          <template #icon><i class="ri-refresh-line"></i></template>
          {{ t('donation.refresh') }}
        </n-button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div
          v-for="(donor, index) in visibleDonors"
          :key="donor.id"
          class="donor-card group"
          :class="index < FIRST_BATCH ? 'animate-fade-in-up' : ''"
          :style="index < FIRST_BATCH ? { animationDelay: `${index * 10}ms` } : undefined"
        >
          <div
            class="h-full bg-white dark:bg-neutral-800/50 border border-gray-100 dark:border-gray-800 rounded-lg p-3 flex gap-3 hover:border-primary/30 hover:shadow-sm hover:bg-white dark:hover:bg-neutral-800 transition-opacity duration-200"
          >
            <!-- 头像 -->
            <div class="relative flex-shrink-0">
              <div
                class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border border-gray-100 dark:border-gray-700"
                :class="avatarColorClass(donor.name)"
              >
                {{ avatarInitial(donor.name) }}
              </div>
              <div
                v-if="index < 3"
                class="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white border border-white dark:border-gray-800"
                :class="[
                  index === 0 ? 'bg-primary' : index === 1 ? 'bg-neutral-400' : 'bg-primary/80'
                ]"
              >
                <i class="ri-trophy-fill"></i>
              </div>
            </div>

            <!-- 信息 -->
            <div class="flex-1 min-w-0 flex flex-col justify-center">
              <div class="flex justify-between items-center">
                <span class="font-bold text-gray-900 dark:text-gray-100 truncate text-sm">
                  {{ donor.name }}
                </span>
                <span class="text-xs font-mono text-primary/80 bg-primary/5 px-1.5 py-0.5 rounded">
                  ¥{{ donor.amount }}
                </span>
              </div>

              <!-- 留言或日期 -->
              <div class="mt-1">
                <div
                  v-if="donor.message"
                  class="text-xs text-gray-500 dark:text-gray-400 truncate border-b border-dashed border-gray-300 dark:border-gray-600 inline-block max-w-full"
                  :title="donor.message"
                >
                  "{{ donor.message }}"
                </div>
                <div v-else class="text-xs text-gray-400 dark:text-gray-600">
                  {{ donor.date }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 自动加载哨兵 -->
      <div v-if="hasMore" ref="sentinelRef" class="h-1"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { Donor } from '@/api/donation';
import { getDonationList } from '@/api/donation';
import alipay from '@/assets/alipay.png';
import wechat from '@/assets/wechat.png';

const { t } = useI18n();

const PAGE_SIZE = 40;
const FIRST_BATCH = 16;

const AVATAR_COLORS = [
  'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  'bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary',
  'bg-primary/15 text-primary dark:bg-primary/20 dark:text-primary',
  'bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary',
  'bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary',
  'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
  'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
  'bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary'
];

const allDonors = ref<Donor[]>([]);
const visibleCount = ref(PAGE_SIZE);
const isLoading = ref(false);
const sentinelRef = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

const visibleDonors = computed(() => allDonors.value.slice(0, visibleCount.value));
const hasMore = computed(() => visibleCount.value < allDonors.value.length);

const isTextChar = (ch: string) => /[\p{L}\p{N}]/u.test(ch);

const avatarInitial = (name: string) => {
  if (!name) return '?';
  for (const ch of name) {
    if (isTextChar(ch)) {
      return ch.toUpperCase();
    }
  }
  return '?';
};

const avatarColorClass = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const loadMore = () => {
  visibleCount.value = Math.min(visibleCount.value + PAGE_SIZE, allDonors.value.length);
};

const setupObserver = () => {
  if (observer) observer.disconnect();
  if (!sentinelRef.value) return;
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && hasMore.value) {
        loadMore();
      }
    },
    { rootMargin: '200px' }
  );
  observer.observe(sentinelRef.value);
};

watch(sentinelRef, (el) => {
  if (el) setupObserver();
});

onBeforeUnmount(() => {
  observer?.disconnect();
});

const fetchDonors = async () => {
  isLoading.value = true;
  try {
    const data = await getDonationList();
    allDonors.value = data.sort((a, b) => Number(b.amount) - Number(a.amount));
    visibleCount.value = PAGE_SIZE;
  } catch (error) {
    console.error('Failed to fetch donors:', error);
  } finally {
    isLoading.value = false;
  }
};

const toDonateList = () => {
  window.open('http://donate.alger.fun/download', '_blank');
};

onMounted(() => fetchDonors());
onActivated(() => fetchDonors());
</script>

<style scoped>
.animate-fade-in-up {
  animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
