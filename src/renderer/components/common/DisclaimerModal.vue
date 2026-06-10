<template>
  <Teleport to="body">
    <Transition name="disclaimer-modal">
      <div
        v-if="showDisclaimer"
        class="disclaimer-modal-shell fixed inset-0 z-[999999] flex items-center justify-center bg-black/45"
      >
        <div
          class="disclaimer-modal-card w-full max-w-md mx-4 bg-white dark:bg-gray-900 rounded-lg overflow-hidden border border-neutral-100 dark:border-neutral-800"
        >
          <div class="h-1 bg-primary"></div>
          <h2 class="text-2xl font-bold text-center text-gray-900 dark:text-white px-6 mt-10">
            {{ t('comp.disclaimer.title') }}
          </h2>

          <div class="px-6 py-6">
            <div class="space-y-4 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              <div
                class="p-4 rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/10 dark:border-primary/15"
              >
                <div class="flex items-start gap-3">
                  <i class="ri-alert-line text-primary text-xl flex-shrink-0 mt-0.5"></i>
                  <p class="text-neutral-700 dark:text-neutral-300">
                    {{ t('comp.disclaimer.warning') }}
                  </p>
                </div>
              </div>

              <div class="space-y-3">
                <div class="flex items-start gap-3">
                  <div
                    class="w-6 h-6 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0"
                  >
                    <i class="ri-book-2-line text-primary text-sm"></i>
                  </div>
                  <p>{{ t('comp.disclaimer.item1') }}</p>
                </div>

                <div class="flex items-start gap-3">
                  <div
                    class="w-6 h-6 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0"
                  >
                    <i class="ri-time-line text-primary text-sm"></i>
                  </div>
                  <p>{{ t('comp.disclaimer.item2') }}</p>
                </div>

                <div class="flex items-start gap-3">
                  <div
                    class="w-6 h-6 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0"
                  >
                    <i class="ri-shield-check-line text-primary text-sm"></i>
                  </div>
                  <p>{{ t('comp.disclaimer.item3') }}</p>
                </div>
              </div>
            </div>
          </div>

          <div class="px-6 pb-8 space-y-3">
            <button
              @click="handleAgree"
              class="w-full py-4 rounded-lg text-base font-medium text-white bg-primary hover:bg-primary/90 active:translate-y-0 transition-colors duration-200"
            >
              <span class="flex items-center justify-center gap-2">
                <i class="ri-check-line text-lg"></i>
                {{ t('comp.disclaimer.agree') }}
              </span>
            </button>

            <button
              @click="handleDisagree"
              class="w-full py-3 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              {{ t('comp.disclaimer.disagree') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="donate-modal">
      <div
        v-if="showDonate"
        class="donate-modal-shell fixed inset-0 z-[999999] flex items-center justify-center bg-black/45"
      >
        <div
          class="donate-modal-card w-full max-w-md mx-4 bg-white dark:bg-gray-900 rounded-lg overflow-hidden border border-neutral-100 dark:border-neutral-800"
        >
          <div class="h-1 bg-primary"></div>

          <div class="flex justify-center pt-8 pb-4">
            <div class="w-20 h-20 rounded-lg bg-primary flex items-center justify-center">
              <i class="ri-heart-3-fill text-4xl text-white"></i>
            </div>
          </div>

          <h2 class="text-2xl font-bold text-center text-gray-900 dark:text-white px-6">
            {{ t('comp.donate.title') }}
          </h2>

          <p class="text-sm text-gray-500 dark:text-gray-400 text-center mt-2 px-6">
            {{ t('comp.donate.subtitle') }}
          </p>

          <div class="px-6 py-6">
            <div
              class="p-4 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 mb-6"
            >
              <div class="flex items-start gap-3">
                <i class="ri-gift-line text-rose-500 text-xl flex-shrink-0 mt-0.5"></i>
                <p class="text-rose-700 dark:text-rose-300 text-sm">
                  {{ t('comp.donate.tip') }}
                </p>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <button
                @click="openDonateLink('wechat')"
                class="flex flex-col items-center gap-2 p-4 rounded-lg bg-primary/10 dark:bg-primary/15 border border-primary/20 dark:border-primary/25 hover:bg-primary/15 dark:hover:bg-primary/20 transition-colors"
              >
                <div class="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
                  <i class="ri-wechat-fill text-2xl text-white"></i>
                </div>
                <span class="text-sm font-medium text-primary">{{ t('comp.donate.wechat') }}</span>
              </button>

              <button
                @click="openDonateLink('alipay')"
                class="flex flex-col items-center gap-2 p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <div class="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
                  <i class="ri-alipay-fill text-2xl text-white"></i>
                </div>
                <span class="text-sm font-medium text-primary">{{ t('comp.donate.alipay') }}</span>
              </button>
            </div>
          </div>

          <div class="px-6 pb-8">
            <button
              @click="handleEnterApp"
              class="w-full py-4 rounded-lg text-base font-medium text-white bg-neutral-800 dark:bg-neutral-700 hover:bg-neutral-900 dark:hover:bg-neutral-600 active:translate-y-0 transition-colors duration-200"
            >
              <span class="flex items-center justify-center gap-2">
                <i class="ri-arrow-right-line text-lg"></i>
                {{ t('comp.donate.enterApp') }}
              </span>
            </button>

            <p class="text-xs text-gray-400 dark:text-gray-500 text-center mt-3">
              {{ t('comp.donate.noForce') }}
            </p>
          </div>
        </div>
      </div>
    </Transition>

    <Transition name="qrcode-modal">
      <div
        v-if="showQRCode"
        class="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/55"
        @click.self="closeQRCode"
      >
        <div
          class="w-full max-w-sm mx-4 bg-white dark:bg-gray-900 rounded-lg overflow-hidden border border-neutral-100 dark:border-neutral-800"
        >
          <div class="h-2" :class="qrcodeType === 'wechat' ? 'bg-primary' : 'bg-neutral-500'"></div>

          <div class="flex items-center justify-between px-6 py-4">
            <h3 class="text-lg font-bold text-gray-900 dark:text-white">
              {{ qrcodeType === 'wechat' ? t('comp.donate.wechatQR') : t('comp.donate.alipayQR') }}
            </h3>
            <button
              @click="closeQRCode"
              class="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <i class="ri-close-line text-xl"></i>
            </button>
          </div>

          <div class="px-6 pb-6">
            <div class="bg-white p-4 rounded-lg">
              <img
                :src="qrcodeType === 'wechat' ? wechatQRCode : alipayQRCode"
                :alt="qrcodeType === 'wechat' ? 'WeChat QR Code' : 'Alipay QR Code'"
                class="w-full rounded-lg"
              />
            </div>
            <p class="text-sm text-gray-500 dark:text-gray-400 text-center mt-4">
              {{ t('comp.donate.scanTip') }}
            </p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import alipayQRCode from '@/assets/alipay.png';
import wechatQRCode from '@/assets/wechat.png';
import { isElectron, isLyricWindow } from '@/utils';

import config from '../../../../package.json';

const { t } = useI18n();

const DISCLAIMER_AGREED_KEY = 'disclaimer_agreed_timestamp';
const DONATION_SHOWN_VERSION_KEY = 'donation_shown_version';

const showDisclaimer = ref(false);
const showDonate = ref(false);
const showQRCode = ref(false);
const qrcodeType = ref<'wechat' | 'alipay'>('wechat');
const isTransitioning = ref(false);

const shouldShowDisclaimer = () => {
  return !localStorage.getItem(DISCLAIMER_AGREED_KEY);
};

const shouldShowDonateAfterUpdate = () => {
  if (!localStorage.getItem(DISCLAIMER_AGREED_KEY)) return false;
  const shownVersion = localStorage.getItem(DONATION_SHOWN_VERSION_KEY);
  return shownVersion !== config.version;
};

const handleAgree = () => {
  if (isTransitioning.value) return;
  isTransitioning.value = true;

  showDisclaimer.value = false;
  setTimeout(() => {
    showDonate.value = true;
    isTransitioning.value = false;
  }, 300);
};

const handleDisagree = () => {
  if (isTransitioning.value) return;
  isTransitioning.value = true;

  if (isElectron) {
    window.api?.quitApp?.();
  } else {
    window.close();
  }
  isTransitioning.value = false;
};

const openDonateLink = (type: 'wechat' | 'alipay') => {
  if (isTransitioning.value) return;

  qrcodeType.value = type;
  showQRCode.value = true;
};

const closeQRCode = () => {
  showQRCode.value = false;
};

const handleEnterApp = () => {
  if (isTransitioning.value) return;
  isTransitioning.value = true;

  localStorage.setItem(DISCLAIMER_AGREED_KEY, Date.now().toString());
  localStorage.setItem(DONATION_SHOWN_VERSION_KEY, config.version);
  showDonate.value = false;

  setTimeout(() => {
    isTransitioning.value = false;
  }, 300);
};

onMounted(() => {
  if (isLyricWindow.value) return;

  if (shouldShowDisclaimer()) {
    showDisclaimer.value = true;
    return;
  }

  if (shouldShowDonateAfterUpdate()) {
    showDonate.value = true;
  }
});
</script>

<style scoped>
.disclaimer-modal-enter-active,
.disclaimer-modal-leave-active {
  transition: opacity 0.3s ease;
}

.disclaimer-modal-enter-from,
.disclaimer-modal-leave-to {
  opacity: 0;
}

.donate-modal-enter-active,
.donate-modal-leave-active {
  transition: opacity 0.3s ease;
}

.donate-modal-enter-from,
.donate-modal-leave-to {
  opacity: 0;
}

.qrcode-modal-enter-active,
.qrcode-modal-leave-active {
  transition: opacity 0.3s ease;
}

.qrcode-modal-enter-from,
.qrcode-modal-leave-to {
  opacity: 0;
}
</style>
