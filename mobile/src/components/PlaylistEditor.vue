<script setup lang="ts">
import { shallowRef } from 'vue';

import { createPlaylist, type LocalPlaylist, renamePlaylist, toast } from '@/stores/library';

import CoverArt from './CoverArt.vue';
import SheetFrame from './SheetFrame.vue';
const props = defineProps<{ playlist?: LocalPlaylist }>();
const emit = defineEmits<{ close: [] }>();
const name = shallowRef(props.playlist?.title || '');
function save() {
  if (!name.value.trim()) return;
  if (props.playlist) renamePlaylist(props.playlist.id, name.value);
  else createPlaylist(name.value);
  toast(props.playlist ? '歌单名称已更新' : '歌单已创建，在歌曲菜单中即可添加音乐');
  emit('close');
}
</script>
<template>
  <sheet-frame :title="playlist ? '编辑歌单' : '新建歌单'" @close="emit('close')"
    ><view class="playlist-form"
      ><view class="playlist-form-art"
        ><cover-art :src="playlist?.tracks[0]?.cover" radius="14px" /></view
      ><text class="form-label">歌单名称</text
      ><input
        v-model="name"
        class="field-input"
        maxlength="40"
        placeholder="给喜欢的音乐起个名字"
        focus
        confirm-type="done"
        @confirm="save"
      /><text class="form-counter">{{ name.length }} / 40</text
      ><button role="button" class="primary-button" :disabled="!name.trim()" @click="save">
        {{ playlist ? '保存修改' : '创建歌单' }}
      </button></view
    ></sheet-frame
  >
</template>
<style scoped>
.playlist-form {
  padding: 4px 22px 15px;
  display: flex;
  flex-direction: column;
}
.playlist-form-art {
  height: 76px;
  width: 76px;
  margin: 0 auto 26px;
}
.form-label {
  font-size: calc(13px + var(--font-size-adjustment));
  color: var(--qqm-muted);
  margin-bottom: 10px;
}
.form-counter {
  font-size: calc(11px + var(--font-size-adjustment));
  color: var(--qqm-muted);
  text-align: right;
  margin: 8px 0 24px;
}
.playlist-form .primary-button {
  width: 100%;
}
</style>
