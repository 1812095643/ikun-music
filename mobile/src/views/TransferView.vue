<script setup lang="ts">
import qrcode from 'qrcode-generator';
import { computed, shallowRef, watch } from 'vue';

import {
  cancelTransfer,
  readTransferText,
  saveTransferFile,
  sendText,
  shareFiles,
  startTransfer,
  stopTransfer,
  transferBusy,
  transferError,
  transferInfo,
  type TransferItem,
  transferItems,
  transferProgress
} from '@/services/transfer';
import { secondaryPage } from '@/stores/browse';
import { toast } from '@/stores/library';
const addressIndex = shallowRef(0);
const text = shallowRef('');
const sending = shallowRef(false);
const expandedText = shallowRef<Record<string, string>>({});
const address = computed(
  () =>
    transferInfo.value.addresses?.[addressIndex.value] || transferInfo.value.addresses?.[0] || ''
);
const codeImage = computed(() => {
  if (!address.value || !transferInfo.value.code) return '';
  const qr = qrcode(0, 'M');
  qr.addData(`${address.value}/#code=${transferInfo.value.code}`);
  qr.make();
  return qr.createDataURL(5, 12);
});
watch(
  () => transferInfo.value.running,
  () => {
    addressIndex.value = 0;
  }
);
const incoming = computed(() =>
  transferItems.value.filter((item) => item.direction === 'incoming')
);
const outgoing = computed(() =>
  transferItems.value.filter((item) => item.direction === 'outgoing')
);
const activeList = shallowRef<'incoming' | 'outgoing'>('incoming');
const visibleItems = computed(() =>
  activeList.value === 'incoming' ? incoming.value : outgoing.value
);
function size(value: number) {
  return value >= 1024 * 1024
    ? `${(value / 1024 / 1024).toFixed(1)} MB`
    : `${(value / 1024).toFixed(1)} KB`;
}
async function act(callback: () => Promise<unknown>) {
  try {
    await callback();
  } catch (error) {
    toast((error as Error).message);
  }
}
async function copy(item: TransferItem) {
  const value = await readTransferText(item);
  expandedText.value = { ...expandedText.value, [item.id]: value };
  await uni.setClipboardData({ data: value });
}
async function publishText() {
  if (!text.value.trim()) return;
  sending.value = true;
  try {
    await sendText(text.value);
  } finally {
    sending.value = false;
  }
}
function copyAddress() {
  if (address.value) void uni.setClipboardData({ data: address.value });
}
</script>
<template>
  <scroll-view scroll-y class="content-scroll transfer-view">
    <view class="transfer-intro"
      ><view
        ><text class="transfer-kicker">设备之间，轻松分享</text
        ><text class="transfer-title">局域网互传</text
        ><text class="transfer-subtitle">任意文件与长文本，直接传到另一台设备。</text></view
      ><text class="transfer-symbol ri-share-forward-box-line"
    /></view>
    <view class="transfer-grid">
      <view class="transfer-connection">
        <template v-if="transferInfo.running"
          ><view class="connection-heading"
            ><text class="online-dot" /><text>互传已开启</text
            ><text class="paired-count">已配对 {{ transferInfo.peerCount || 0 }} 台</text></view
          >
          <image v-if="codeImage" class="transfer-qr" :src="codeImage" mode="aspectFit" />
          <text v-else class="network-hint">尚未找到局域网地址，请连接 Wi-Fi 或手机热点。</text>
          <text class="pair-label">连接码</text
          ><text class="pair-code">{{ transferInfo.code }}</text>
          <button role="button" class="address-button" @click="copyAddress">
            {{ address || '等待网络连接' }}<text class="ri-file-copy-line" />
          </button>
          <view v-if="(transferInfo.addresses?.length || 0) > 1" class="address-options"
            ><button
              role="button"
              v-for="(value, index) in transferInfo.addresses"
              :key="value"
              class="address-option"
              :class="{ selected: addressIndex === index }"
              @click="addressIndex = index"
            >
              网络 {{ index + 1 }}
            </button></view
          >
          <text class="connection-help">另一台设备扫码，或在浏览器输入上方地址和连接码。</text
          ><button role="button" class="text-button" @click="act(stopTransfer)">关闭互传</button>
        </template>
        <template v-else
          ><view class="connection-idle"><text class="ri-wifi-line" /></view
          ><text class="connection-idle-title">连接同一 Wi-Fi 或热点</text
          ><text class="connection-help"
            >开启后，手机浏览器就能传文件。无需安装配套 App，文件不经过云端。</text
          ><button
            role="button"
            class="primary-button"
            :disabled="transferBusy"
            @click="startTransfer"
          >
            {{ transferBusy ? '正在开启' : '开启局域网互传' }}
          </button></template
        >
        <text v-if="transferError" class="transfer-error" role="alert">{{ transferError }}</text>
      </view>
      <view class="transfer-send"
        ><text class="send-heading">分享给另一台设备</text
        ><button
          role="button"
          class="send-file"
          :disabled="!transferInfo.running"
          @click="act(shareFiles)"
        >
          <text class="ri-folder-upload-line" /><view
            ><text>选择文件</text
            ><text class="send-description">照片、文档、音乐、安装包……</text></view
          ><text class="ri-add-line" />
        </button>
        <textarea
          v-model="text"
          :maxlength="-1"
          class="transfer-textarea"
          placeholder="粘贴文字、链接或整段歌单列表"
          :disabled="!transferInfo.running"
        />
        <view class="send-text-row"
          ><text>{{ text.length }} 字</text
          ><button
            role="button"
            class="primary-button"
            :disabled="!transferInfo.running || !text.trim() || sending"
            @click="act(publishText)"
          >
            {{ sending ? '发送中' : '发送文字' }}
          </button></view
        >
        <view class="transfer-hint"
          ><text class="ri-file-list-3-line" /><text
            >收到歌单文字后，手动复制，再到「歌单 → 文字导入」识别。</text
          ><button role="button" class="text-button" @click="secondaryPage = 'import'">
            去导入
          </button></view
        >
      </view>
    </view>
    <view v-if="transferProgress.length" class="transfer-jobs"
      ><view v-for="job in transferProgress" :key="job.id" class="transfer-job"
        ><view class="job-heading"
          ><text class="ellipsis">{{ job.name }}</text
          ><button role="button" class="text-button" @click="act(() => cancelTransfer(job.id))">
            取消
          </button></view
        ><progress
          :percent="job.size > 0 ? Math.min(100, Math.round((job.received / job.size) * 100)) : 0"
          stroke-width="4"
          activeColor="#1ecf73"
        /><text
          >{{ size(job.received)
          }}{{ job.size >= 0 ? ` / ${size(job.size)}` : ' · 正在读取文件' }}</text
        ></view
      ></view
    >
    <view class="transfer-list-heading"
      ><button
        role="button"
        :class="{ selected: activeList === 'incoming' }"
        @click="activeList = 'incoming'"
      >
        收到的内容 {{ incoming.length }}</button
      ><button
        role="button"
        :class="{ selected: activeList === 'outgoing' }"
        @click="activeList = 'outgoing'"
      >
        已分享 {{ outgoing.length }}
      </button></view
    >
    <view v-if="!visibleItems.length" class="state-box">{{
      activeList === 'incoming'
        ? '收到的文件与文字会留在这里'
        : '分享后，对方可以在浏览器中保存文件和复制文字'
    }}</view>
    <view v-for="item in visibleItems" :key="item.id" class="transfer-item"
      ><view class="transfer-item-heading"
        ><text :class="item.kind === 'text' ? 'ri-file-text-line' : 'ri-file-line'" /><view
          ><text class="transfer-item-name">{{ item.name }}</text
          ><text class="transfer-item-meta"
            >{{ size(item.size) }} · {{ new Date(item.createdAt).toLocaleString() }}</text
          ></view
        ><button
          role="button"
          class="text-button"
          :disabled="!transferInfo.running"
          @click="act(() => (item.kind === 'text' ? copy(item) : saveTransferFile(item)))"
        >
          {{ item.kind === 'text' ? '复制全文' : '保存到' }}
        </button></view
      ><text v-if="item.kind === 'text'" selectable class="transfer-item-text">{{
        expandedText[item.id] || item.preview
      }}</text></view
    >
    <view class="content-bottom" />
  </scroll-view>
</template>
<style scoped>
.transfer-intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22px var(--page-gutter) 26px;
  gap: 20px;
}
.transfer-intro text {
  display: block;
}
.transfer-kicker {
  color: var(--qqm-accent-text);
  font-size: 12px;
  letter-spacing: 1px;
}
.transfer-title {
  font-size: calc(29px + var(--font-size-adjustment));
  font-weight: 600;
  margin: 10px 0;
}
.transfer-subtitle {
  font-size: calc(14px + var(--font-size-adjustment));
  color: var(--qqm-muted);
  line-height: 1.7;
}
.transfer-symbol {
  font-size: 44px;
  color: var(--qqm-accent-text);
}
.transfer-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
  padding: 0 var(--page-gutter);
}
.transfer-connection,
.transfer-send {
  padding: 24px;
  border-radius: 20px;
  background: var(--qqm-surface);
  min-width: 0;
}
.transfer-connection {
  display: flex;
  align-items: center;
  flex-direction: column;
  text-align: center;
}
.connection-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  align-self: stretch;
  font-size: 14px;
}
.online-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--qqm-primary);
}
.paired-count {
  margin-left: auto;
  color: var(--qqm-muted);
  font-size: 11px;
}
.transfer-qr {
  width: 168px;
  height: 168px;
  background: #fff;
  border-radius: 12px;
  margin: 24px 0 18px;
}
.pair-label {
  font-size: 11px;
  color: var(--qqm-muted);
}
.pair-code {
  font-size: 29px;
  letter-spacing: 7px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  margin: 7px 0 14px;
}
.address-button {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 13px !important;
  min-height: 44px;
  word-break: break-all;
}
.connection-help,
.network-hint {
  font-size: 12px;
  color: var(--qqm-muted);
  line-height: 1.9;
  margin: 15px 0;
}
.connection-idle {
  font-size: 40px;
  color: var(--qqm-accent-text);
  margin: 15px 0 18px;
}
.connection-idle-title {
  font-size: calc(18px + var(--font-size-adjustment));
  font-weight: 600;
}
.transfer-connection .primary-button {
  margin: 14px 0 !important;
}
.transfer-error {
  color: #b96544;
  font-size: 13px;
  line-height: 1.8;
  margin-top: 15px;
}
.address-options {
  display: flex;
  gap: 8px;
}
.address-option {
  padding: 8px 12px !important;
  font-size: 11px !important;
  border-radius: 16px !important;
}
.address-option.selected {
  background: var(--qqm-primary-soft) !important;
  color: var(--qqm-accent-text) !important;
}
.send-heading {
  font-size: calc(18px + var(--font-size-adjustment));
  font-weight: 600;
}
.send-file {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 0 !important;
  margin: 10px 0 !important;
  text-align: left;
  border-bottom: 1px solid var(--qqm-border);
}
.send-file > text:first-child {
  font-size: 29px;
  color: var(--qqm-accent-text);
}
.send-file > view {
  flex: 1;
  font-size: calc(15px + var(--font-size-adjustment));
}
.send-description {
  display: block;
  font-size: 11px;
  color: var(--qqm-muted);
  margin-top: 6px;
}
.transfer-textarea {
  width: 100%;
  height: 165px;
  background: var(--qqm-surface-muted);
  border-radius: 12px;
  padding: 14px;
  font-size: 14px;
  line-height: 1.7;
}
.send-text-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 15px;
  color: var(--qqm-muted);
  font-size: 12px;
}
.transfer-hint {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 24px;
  color: var(--qqm-muted);
  font-size: 12px;
  line-height: 1.8;
}
.transfer-hint > text:nth-child(2) {
  flex: 1;
}
.transfer-hint .text-button {
  white-space: nowrap;
}
.transfer-list-heading {
  display: flex;
  gap: 24px;
  padding: 28px var(--page-gutter) 12px;
}
.transfer-list-heading button {
  min-height: 44px;
  font-size: calc(16px + var(--font-size-adjustment)) !important;
  color: var(--qqm-muted) !important;
}
.transfer-list-heading .selected {
  color: var(--qqm-text) !important;
  font-weight: 600 !important;
}
.transfer-item,
.transfer-job {
  margin: 0 var(--page-gutter) 12px;
  padding: 18px 20px;
  background: var(--qqm-surface);
  border-radius: 16px;
}
.transfer-item-heading {
  display: flex;
  align-items: center;
  gap: 14px;
}
.transfer-item-heading > text:first-child {
  font-size: 26px;
  color: var(--qqm-accent-text);
}
.transfer-item-heading > view {
  min-width: 0;
  flex: 1;
}
.transfer-item-name {
  display: block;
  overflow-wrap: anywhere;
  font-size: 14px;
}
.transfer-item-meta {
  display: block;
  font-size: 10px;
  color: var(--qqm-muted);
  margin-top: 6px;
}
.transfer-item-text {
  display: block;
  margin-top: 14px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 260px;
  overflow: auto;
  font-size: 14px;
  line-height: 1.8;
}
.transfer-jobs {
  margin-top: 20px;
}
.job-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.job-heading > text {
  min-width: 0;
}
.transfer-job > text {
  display: block;
  margin-top: 10px;
  color: var(--qqm-muted);
  font-size: 11px;
}
@container music-content (min-width: 760px) {
  .transfer-grid {
    grid-template-columns: minmax(280px, 0.85fr) minmax(0, 1.3fr);
  }
}
</style>
