<script setup lang="ts">
import { onMounted, onUnmounted, shallowRef, watch } from 'vue';
const props = defineProps<{ ready: boolean }>();
const emit = defineEmits<{ complete: [] }>();
const held = shallowRef(false);
const slow = shallowRef(false);
let finished = false;
let holdTimer: ReturnType<typeof setTimeout>;
let slowTimer: ReturnType<typeof setTimeout>;
let fallbackTimer: ReturnType<typeof setTimeout>;
function finishAnimation() {
  if (finished) return;
  finished = true;
  holdTimer = setTimeout(() => {
    held.value = true;
  }, 1000);
}
onMounted(() => {
  fallbackTimer = setTimeout(finishAnimation, 850);
  slowTimer = setTimeout(() => {
    slow.value = true;
  }, 6000);
});
onUnmounted(() => {
  clearTimeout(holdTimer);
  clearTimeout(slowTimer);
  clearTimeout(fallbackTimer);
});
watch(
  () => [held.value, props.ready],
  ([held, ready]) => {
    if (held && ready) emit('complete');
  }
);
</script>
<template>
  <view class="startup" role="status" aria-label="ikun 音乐正在准备"
    ><view class="brand-scene"
      ><view class="brand-aura" /><view class="brand-ring" /><view class="brand-dots"
        ><view /><view /><view /><view /><view /><view /></view
      ><view class="startup-symbol" @animationend.self="finishAnimation"
        ><image src="/static/brand.png" mode="aspectFill" /></view></view
    ><view class="startup-signature"
      ><text class="startup-title">IKUN <text>音乐</text></text
      ><text class="startup-tagline">让生活充满音乐</text
      ><button v-if="slow && held" role="button" class="text-button" @click="emit('complete')">
        先进入首页<text class="ri-arrow-right-line" /></button></view
  ></view>
</template>
<style scoped>
.startup {
  position: absolute;
  inset: 0;
  z-index: 260;
  background: var(--qqm-surface);
  display: flex;
  align-items: center;
  justify-content: center;
}
.brand-scene {
  position: relative;
  width: 255px;
  height: 255px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: -105px;
}
.brand-aura {
  position: absolute;
  inset: 5px;
  background: radial-gradient(
    circle,
    rgba(49, 218, 120, 0.18),
    rgba(49, 218, 120, 0.065) 47%,
    transparent 69%
  );
  animation: aura-in 1.1s ease both;
}
.brand-ring {
  position: absolute;
  inset: 29px;
  border: 1px solid rgba(41, 201, 111, 0.11);
  border-radius: 50%;
}
.startup-symbol {
  position: relative;
  width: 105px;
  height: 105px;
  animation: brand-in 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.startup-symbol image {
  height: 100%;
  width: 100%;
  border-radius: 31px;
  box-shadow:
    0 13px 31px rgba(31, 141, 77, 0.12),
    0 0 0 1px rgba(255, 255, 255, 0.15);
}
.brand-dots {
  position: absolute;
  inset: 0;
}
.brand-dots view {
  position: absolute;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #8bd9aa;
  opacity: 0.65;
}
.brand-dots view:nth-child(1) {
  left: 34px;
  top: 72px;
  width: 7px;
  height: 7px;
}
.brand-dots view:nth-child(2) {
  left: 70px;
  bottom: 32px;
}
.brand-dots view:nth-child(3) {
  right: 31px;
  top: 112px;
}
.brand-dots view:nth-child(4) {
  right: 67px;
  top: 24px;
  width: 3px;
  height: 3px;
}
.brand-dots view:nth-child(5) {
  right: 45px;
  bottom: 55px;
  width: 3px;
  height: 3px;
}
.brand-dots view:nth-child(6) {
  left: 17px;
  bottom: 90px;
  width: 3px;
  height: 3px;
}
.startup-signature {
  position: absolute;
  bottom: calc(13vh + var(--safe-bottom));
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 14px;
}
.startup-title {
  font-size: calc(31px + var(--font-size-adjustment));
  font-weight: 750;
  letter-spacing: 1px;
  color: var(--qqm-accent-text);
}
.startup-title text {
  font-size: calc(24px + var(--font-size-adjustment));
  font-weight: 550;
  letter-spacing: 2px;
}
.startup-tagline {
  font-size: calc(12px + var(--font-size-adjustment));
  letter-spacing: 3px;
  color: var(--qqm-muted);
}
.startup-signature .text-button {
  font-size: calc(12px + var(--font-size-adjustment)) !important;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 9px !important;
}
@keyframes brand-in {
  from {
    opacity: 0;
    transform: translateY(9px) scale(0.92);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes aura-in {
  from {
    opacity: 0;
    transform: scale(0.82);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
