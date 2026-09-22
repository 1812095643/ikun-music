<script setup lang="ts">
import { onMounted, onUnmounted, shallowRef, watch } from 'vue';

const props = defineProps<{ ready: boolean }>();
const emit = defineEmits<{ complete: [] }>();
const brandHeld = shallowRef(false);
const slow = shallowRef(false);
const leaving = shallowRef(false);
let holdTimer: ReturnType<typeof setTimeout>;
let animationFallback: ReturnType<typeof setTimeout>;
let maxTimer: ReturnType<typeof setTimeout>;
let finished = false;
const finishAnimation = () => {
  if (finished) return;
  finished = true;
  // 保留 0a64703 之前的旋转外环，完成一圈后再停留一秒，首页在遮罩后并行加载。
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
  animationFallback = setTimeout(finishAnimation, 2300);
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
    <div class="splash-content">
      <div class="splash-logo-container">
        <img src="@/assets/logo.png" class="splash-logo" alt="ikun 音乐" />
        <div
          class="splash-spinner-disc"
          @animationiteration="finishAnimation"
          @animationend="finishAnimation"
        />
      </div>
      <h1 class="splash-title">IKUN 音乐</h1>
      <p class="splash-subtitle">让生活充满音乐</p>
      <button v-if="slow && brandHeld" type="button" class="splash-continue" @click="leave">
        首页还在准备，先进入 <i class="ri-arrow-right-line" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.splash-screen {
  position: fixed;
  inset: 0;
  z-index: 999999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--qqm-bg, #f7f8fa);
  color: var(--qqm-text, #151922);
}

.dark .splash-screen {
  background: var(--qqm-bg, #111315);
  color: var(--qqm-text, #f4f7f8);
}

.splash-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.splash-logo-container {
  position: relative;
  width: 96px;
  height: 96px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.splash-logo {
  position: absolute;
  width: 80px;
  height: 80px;
  object-fit: contain;
  z-index: 2;
  border-radius: 9999px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.splash-spinner-disc {
  position: absolute;
  width: 96px;
  height: 96px;
  border-radius: 9999px;
  border: 2.5px solid transparent;
  border-top-color: var(--qqm-primary, #1ecf73);
  border-bottom-color: var(--qqm-primary, #1ecf73);
  animation: spin-clockwise 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  z-index: 1;
}

.splash-title {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 5px;
  margin-bottom: 8px;
  background: linear-gradient(
    135deg,
    var(--qqm-primary, #1ecf73) 0%,
    var(--qqm-primary-strong, #0dbd62) 100%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.splash-subtitle {
  font-size: 13px;
  color: var(--qqm-muted, #6f7580);
  font-weight: 600;
  letter-spacing: 3px;
  opacity: 0.8;
}

@keyframes spin-clockwise {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.splash-continue {
  position: absolute;
  bottom: max(32px, 8vh);
  padding: 10px 18px;
  color: var(--qqm-muted);
  background: transparent;
  border: 0;
  font-size: 13px;
  cursor: pointer;
}
.splash-continue:hover {
  color: var(--qqm-primary-strong);
}
@media (prefers-reduced-motion: reduce) {
  .splash-spinner-disc {
    animation-duration: 1ms;
    animation-iteration-count: 1;
  }
}
</style>
