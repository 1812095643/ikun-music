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
          class="absolute -right-4 -top-4 w-24 h-24 rounded-lg bg-primary/5 transition-colors duration-200 group-hover:bg-primary/10"
        ></div>
        <img
          :src="alipay"
          alt="Alipay"
          class="w-52 h-52 rounded-lg border border-neutral-100 dark:border-neutral-800 mb-4"
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
          class="absolute -right-4 -top-4 w-24 h-24 rounded-lg bg-primary/5 transition-colors duration-200 group-hover:bg-primary/10"
        ></div>
        <img
          :src="wechat"
          alt="WeChat"
          class="w-52 h-52 rounded-lg border border-neutral-100 dark:border-neutral-800 mb-4"
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
        <div v-for="(donor, index) in visibleDonors" :key="donor.id" class="donor-card group">
          <div
            class="h-full bg-white dark:bg-black border border-neutral-100 dark:border-neutral-800 rounded-lg p-3 flex gap-3 hover:border-primary/30 hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors duration-200"
          >
            <!-- 头像 -->
            <div class="relative flex-shrink-0">
              <div
                class="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold border border-neutral-100 dark:border-neutral-800"
                :class="avatarColorClass(donor.name)"
              >
                {{ avatarInitial(donor.name) }}
              </div>
              <div
                v-if="index < 3"
                class="absolute -top-1 -right-1 w-4 h-4 rounded-md flex items-center justify-center text-[10px] text-white border border-white dark:border-neutral-900"
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
                <span class="rounded bg-primary/5 px-1.5 py-0.5 font-mono text-xs text-primary/80">
                  ¥{{ donor.amount }}
                </span>
              </div>

              <!-- 留言或日期 -->
              <div class="mt-1">
                <div
                  v-if="donor.message"
                  class="text-xs text-neutral-500 dark:text-neutral-400 truncate border-b border-dashed border-neutral-200 dark:border-neutral-700 inline-block max-w-full"
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
  'bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary',
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

<style scoped></style>
