<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef, watch } from 'vue';

const props = defineProps<{ ready: boolean }>();
const emit = defineEmits<{ complete: [] }>();
const brandHeld = shallowRef(false);
const slow = shallowRef(false);
const leaving = shallowRef(false);
let holdTimer: ReturnType<typeof setTimeout>;
let animationFallback: ReturnType<typeof setTimeout>;
let maxTimer: ReturnType<typeof setTimeout>;
let finished = false;
const status = computed(() => (slow.value ? '首页还在准备，你可以先进入' : '让生活充满音乐'));
const finishAnimation = () => {
  if (finished) return;
  finished = true;
  // 品牌完整出现后再停留一秒，首页请求在遮罩后并行进行。
  holdTimer = setTimeout(() => {
    brandHeld.value = true;
  }, 1000);
};
const leave = () => {
  if (!leaving.value) {
    leaving.value = true;
    emit('complete');
  }
};
watch(
  () => [props.ready, brandHeld.value],
  ([ready, held]) => {
    if (ready && held) leave();
  }
);
onMounted(() => {
  animationFallback = setTimeout(finishAnimation, 900);
  maxTimer = setTimeout(() => {
    slow.value = true;
  }, 6500);
});
onUnmounted(() => {
  clearTimeout(holdTimer);
  clearTimeout(animationFallback);
  clearTimeout(maxTimer);
});
</script>

<template>
  <div class="splash-screen" role="status" aria-label="ikun 音乐正在准备首页">
    <div class="brand" @animationend.self="finishAnimation">
      <img src="@/assets/logo.png" alt="ikun 音乐" width="92" height="92" />
      <h1>IKUN <span>音乐</span></h1>
      <p>{{ status }}</p>
      <button v-if="slow && brandHeld" type="button" @click="leave">
        进入首页 <i class="ri-arrow-right-line" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.splash-screen {
  position: fixed;
  inset: 0;
  z-index: 999999;
  display: grid;
  place-items: center;
  background: var(--qqm-bg, #f7f9f8);
  color: var(--qqm-text, #18231d);
}
.brand {
  text-align: center;
  animation: brand-reveal 800ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.brand img {
  display: block;
  margin: 0 auto 26px;
  object-fit: contain;
}
.brand h1 {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: 0.14em;
  margin: 0;
  color: var(--qqm-primary-strong, #109956);
}
.brand h1 span {
  font-weight: 500;
  letter-spacing: 0.08em;
}
.brand p {
  margin: 15px 0 0;
  font-size: 13px;
  color: var(--qqm-muted, #758078);
  letter-spacing: 0.18em;
}
.brand button {
  margin-top: 24px;
  border: 0;
  background: transparent;
  color: var(--qqm-primary-strong);
  cursor: pointer;
  padding: 10px 18px;
}
@keyframes brand-reveal {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .brand {
    animation-duration: 1ms;
  }
}
</style>
