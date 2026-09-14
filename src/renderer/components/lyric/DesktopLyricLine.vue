<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, shallowRef, useTemplateRef, watch } from 'vue';

import type { ILyricText } from '@/types/music';

const props = defineProps<{
  line: ILyricText;
  active: boolean;
  actualTime: number;
  progress: number;
  fontSize: number;
  showTranslation: boolean;
}>();

const viewportRef = useTemplateRef<HTMLElement>('viewport');
const textRef = useTemplateRef<HTMLElement>('text');
const overflowWidth = shallowRef(0);

/** 测量真实字宽；仅在文本、字号或窗口尺寸变化时读取布局，播放帧只更新位移。 */
const measureText = () => {
  overflowWidth.value = Math.max(
    0,
    (textRef.value?.scrollWidth ?? 0) - (viewportRef.value?.clientWidth ?? 0)
  );
};

// 长句前后各留一小段停顿，确保开头和结尾都能看清；未播放的下一句固定显示开头。
const textStyle = computed(() => ({
  transform: `translateX(${-overflowWidth.value * (props.active ? Math.min(1, Math.max(0, (props.progress - 0.15) / 0.7)) : 0)}px)`
}));

/** 单层字形填色。阴影放在外层，避免旧版 text-shadow 覆盖渐变文字形成灰黑重影。 */
const fillStyle = (progress: number) => ({
  backgroundImage: `linear-gradient(to right, var(--lyric-accent) ${progress * 100}%, var(--lyric-text) ${progress * 100}%)`,
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent'
});

const wordStyle = (word: NonNullable<ILyricText['words']>[number]) => {
  if (!props.active) return {};
  const elapsed = props.actualTime * 1000 - word.startTime;
  const progress =
    word.duration > 0 ? Math.min(1, Math.max(0, elapsed / word.duration)) : Number(elapsed >= 0);
  if (progress === 0) return {};
  if (progress === 1) return { color: 'var(--lyric-accent)' };
  return fillStyle(progress);
};

watch(
  () => [props.line, props.fontSize],
  () => nextTick(measureText),
  { flush: 'post' }
);
let resizeObserver: ResizeObserver | undefined;
onMounted(() => {
  resizeObserver = new ResizeObserver(measureText);
  if (viewportRef.value) resizeObserver.observe(viewportRef.value);
  if (textRef.value) resizeObserver.observe(textRef.value);
  measureText();
});
onUnmounted(() => resizeObserver?.disconnect());
</script>

<template>
  <div
    class="lyric-line"
    :class="{ 'lyric-line-current': active }"
    :style="{ fontSize: `${fontSize}px` }"
  >
    <div
      ref="viewport"
      class="lyric-text-viewport"
      :class="{ 'is-overflowing': overflowWidth > 0 }"
    >
      <div ref="text" class="lyric-text" :style="textStyle">
        <template v-if="line.hasWordByWord && line.words?.length">
          <template v-for="(word, index) in line.words" :key="index">
            <span class="lyric-word" :style="wordStyle(word)">{{ word.text }}</span
            ><span v-if="word.space">&nbsp;</span>
          </template>
        </template>
        <span v-else class="lyric-text-inner" :style="active ? fillStyle(progress) : undefined">{{
          line.text
        }}</span>
      </div>
    </div>
    <div v-if="showTranslation && line.trText" class="lyric-translation" :title="line.trText">
      {{ line.trText }}
    </div>
  </div>
</template>

<style scoped>
.lyric-line {
  width: 100%;
  flex-shrink: 0;
  min-width: 0;
  text-align: center;
  line-height: 1.42;
  font-weight: 500;
  letter-spacing: 0.035em;
  color: var(--lyric-secondary);
}
.lyric-line-current {
  color: var(--lyric-text);
  font-weight: 600;
}
.lyric-text-viewport {
  width: 100%;
  overflow: hidden;
  padding-block: 3px;
}
.lyric-text-viewport.is-overflowing {
  text-align: left;
  mask-image: linear-gradient(
    to right,
    transparent,
    black 8px,
    black calc(100% - 8px),
    transparent
  );
}
.lyric-text {
  display: inline-block;
  width: max-content;
  max-width: none;
  white-space: pre;
  vertical-align: top;
  /* 只给最终字形加一次轻阴影，不叠描边、内阴影或逐字滤镜。 */
  filter: drop-shadow(0 1px 1.2px var(--lyric-shadow));
}
.lyric-word {
  display: inline-block;
}
.lyric-translation {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 8px;
  font-size: 0.58em;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--lyric-secondary);
  filter: drop-shadow(0 1px 1px var(--lyric-shadow));
}
</style>
