<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';

import { registerSheet } from '@/stores/overlays';
defineProps<{ title: string }>();
const emit = defineEmits<{ close: [] }>();
let unregister: (() => void) | undefined;
onMounted(() => {
  unregister = registerSheet(() => emit('close'));
});
onUnmounted(() => unregister?.());
</script>
<template>
  <view class="sheet-backdrop" @click.self="emit('close')">
    <view class="bottom-sheet" role="dialog" aria-modal="true" :aria-label="title">
      <view class="sheet-handle" />
      <view class="sheet-heading"
        ><text class="sheet-title">{{ title }}</text
        ><button role="button" class="button-icon muted" aria-label="关闭" @click="emit('close')">
          <text class="ri-close-line" /></button
      ></view>
      <scroll-view scroll-y class="sheet-body"><slot /></scroll-view>
    </view>
  </view>
</template>
