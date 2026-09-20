<script setup lang="ts">
import { shallowRef } from 'vue';

import { type LocalPlaylist, removePlaylist, toast } from '@/stores/library';
import { playTracks } from '@/stores/player';

import SheetFrame from './SheetFrame.vue';
const props = defineProps<{ playlist: LocalPlaylist }>();
const emit = defineEmits<{ close: []; edit: [playlist: LocalPlaylist] }>();
const confirming = shallowRef(false);
function remove() {
  removePlaylist(props.playlist.id);
  toast('歌单已删除');
  emit('close');
}
</script>
<template>
  <sheet-frame :title="confirming ? '删除这张歌单？' : playlist.title" @close="emit('close')"
    ><template v-if="!confirming"
      ><button
        role="button"
        class="sheet-row"
        :disabled="!playlist.tracks.length"
        @click="
          playTracks(playlist.tracks);
          emit('close');
        "
      >
        <text class="sheet-row-icon ri-play-circle-line" /><text>播放全部</text
        ><text class="sheet-row-end" style="font-size: calc(13px + var(--font-size-adjustment))"
          >{{ playlist.tracks.length }}首</text
        ></button
      ><button role="button" class="sheet-row" @click="emit('edit', playlist)">
        <text class="sheet-row-icon ri-edit-line" /><text>修改名称</text></button
      ><button role="button" class="sheet-row" style="color: #d6636b" @click="confirming = true">
        <text class="sheet-row-icon ri-delete-bin-6-line" /><text>删除歌单</text>
      </button></template
    ><view v-else class="delete-confirm"
      ><text>将移除「{{ playlist.title }}」及其中的歌曲记录。</text
      ><button role="button" class="delete-button" @click="remove">确认删除</button
      ><button role="button" class="text-button" @click="confirming = false">保留歌单</button></view
    ></sheet-frame
  >
</template>
<style scoped>
.delete-confirm {
  padding: 5px 22px 10px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  font-size: calc(14px + var(--font-size-adjustment));
  line-height: 1.7;
  color: var(--qqm-muted);
}
.delete-button {
  background: #f8e8e9 !important;
  color: #bd4c59 !important;
  border-radius: 23px !important;
  padding: 13px !important;
  font-size: calc(15px + var(--font-size-adjustment)) !important;
}
</style>
