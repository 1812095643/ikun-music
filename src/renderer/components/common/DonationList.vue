<template>
  <div class="donation-section">
    <!-- 头部引导区 -->
    <div class="my-8 text-center">
      <p class="text-neutral-500 dark:text-neutral-400 max-w-2xl mx-auto">
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
        class="pay-card group relative overflow-hidden rounded-lg border border-primary/15 p-6 flex flex-col items-center transition-colors"
      >
        <div
          class="donation-card-glow absolute -right-4 -top-4 w-24 h-24 rounded-lg transition-colors duration-200"
        ></div>
        <img :src="alipay" alt="Alipay" class="donation-qr-surface w-52 h-52 rounded-lg mb-4" />
        <div class="flex items-center gap-2 text-primary font-bold text-lg">
          <i class="ri-alipay-fill text-2xl"></i>
          {{ t('common.alipay') }}
        </div>
      </div>

      <!-- 微信支付 -->
      <div
        class="pay-card group relative overflow-hidden rounded-lg border border-primary/15 p-6 flex flex-col items-center transition-colors"
      >
        <div
          class="donation-card-glow absolute -right-4 -top-4 w-24 h-24 rounded-lg transition-colors duration-200"
        ></div>
        <img :src="wechat" alt="WeChat" class="donation-qr-surface w-52 h-52 rounded-lg mb-4" />
        <div class="flex items-center gap-2 text-primary font-bold text-lg">
          <i class="ri-wechat-pay-fill text-2xl"></i>
          {{ t('common.wechat') }}
        </div>
      </div>
    </div>

    <!-- 捐赠者列表 -->
    <div class="donors-list px-4">
      <div class="flex items-center justify-between mb-4 px-1">
        <h4
          class="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2"
        >
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
            class="donation-record-card h-full rounded-lg p-3 flex gap-3 transition-colors duration-200"
          >
            <!-- 头像 -->
            <div class="relative flex-shrink-0">
              <div
                class="donation-avatar-surface w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold"
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
                <span class="font-bold text-neutral-900 dark:text-neutral-100 truncate text-sm">
                  {{ donor.name }}
                </span>
                <span
                  class="donation-amount-badge rounded px-1.5 py-0.5 font-mono text-xs text-primary/80"
                >
                  ¥{{ donor.amount }}
                </span>
              </div>

              <!-- 留言或日期 -->
              <div class="mt-1">
                <div
                  v-if="donor.message"
                  class="donation-name-link text-xs text-neutral-500 dark:text-neutral-400 truncate inline-block max-w-full"
                  :title="donor.message"
                >
                  "{{ donor.message }}"
                </div>
                <div v-else class="text-xs text-neutral-400 dark:text-neutral-600">
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
  'donation-primary-badge text-primary',
  'donation-primary-badge text-primary',
  'donation-primary-badge text-primary',
  'donation-primary-badge text-primary',
  'donation-primary-badge text-primary',
  'donation-badge-surface text-neutral-600 dark:text-neutral-300',
  'donation-badge-surface text-neutral-600 dark:text-neutral-300',
  'donation-primary-badge text-primary'
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
.donation-qr-surface,
.donation-record-card,
.donation-avatar-surface,
.donation-badge-surface {
  border: 1px solid var(--qqm-border);
  background: var(--qqm-surface);
}

.donation-record-card:hover {
  border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 24%, var(--qqm-border));
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 6%, var(--qqm-surface));
}

.donation-name-link {
  border-bottom: 1px dashed var(--qqm-border);
}

.pay-card {
  background: color-mix(in srgb, var(--qqm-surface, #fff) 94%, transparent);
}

.pay-card:hover {
  border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 24%, var(--qqm-border));
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 6%, var(--qqm-surface));
}

.donation-card-glow {
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 5%, transparent);
}

.group:hover .donation-card-glow {
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 9%, transparent);
}

.donation-amount-badge,
.donation-primary-badge {
  border: 1px solid color-mix(in srgb, var(--qqm-primary, #22c55e) 16%, var(--qqm-border));
  background: color-mix(in srgb, var(--qqm-primary, #22c55e) 5%, var(--qqm-surface));
}
</style>
