import { shallowRef } from 'vue';

import { toast } from '@/stores/library';

import { nativeDevice, nativeProblem, runNativeOperation } from './nativeDevice';

export interface TransferItem {
  id: string;
  name: string;
  size: number;
  kind: 'file' | 'text';
  direction: 'incoming' | 'outgoing';
  createdAt: number;
  preview?: string;
}
export interface TransferProgress {
  id: string;
  name: string;
  size: number;
  received: number;
  direction: string;
}
export interface TransferInfo {
  running: boolean;
  starting?: boolean;
  addresses?: string[];
  code?: string;
  ownerToken?: string;
  port?: number;
  message?: string;
  peerCount?: number;
}
export const transferInfo = shallowRef<TransferInfo>({ running: false });
export const transferItems = shallowRef<TransferItem[]>([]);
export const transferProgress = shallowRef<TransferProgress[]>([]);
export const transferBusy = shallowRef(false);
export const transferError = shallowRef('');
let refreshTimer: ReturnType<typeof setInterval> | undefined;
let refreshing = false;

async function request<T>(
  path: string,
  method: 'GET' | 'POST' | 'DELETE' = 'GET',
  data?: Record<string, unknown>
): Promise<T> {
  let base = `http://127.0.0.1:${transferInfo.value.port}`;
  // #ifdef H5
  base = '/__transfer/proxy';
  // #endif
  return new Promise((resolve, reject) =>
    uni.request({
      url: base + path,
      method,
      data,
      header: {
        'x-ikun-token': transferInfo.value.ownerToken || '',
        'content-type': 'application/json'
      },
      success: (result) =>
        result.statusCode >= 200 && result.statusCode < 300
          ? resolve(result.data as T)
          : reject(
              new Error(
                (result.data as { message?: string })?.message || '连接中断，请重新开启互传'
              )
            ),
      fail: () => reject(new Error('暂时无法连接互传服务，请重新开启'))
    })
  );
}
export async function startTransfer() {
  if (transferBusy.value || transferInfo.value.running) return;
  transferBusy.value = true;
  transferError.value = '';
  try {
    // #ifdef APP-PLUS
    const kit = nativeDevice();
    if (!kit) throw nativeProblem();
    kit.startTransfer(
      plus.io.convertLocalFileSystemURL('_doc/transfer/inbox'),
      plus.io.convertLocalFileSystemURL('_doc/transfer/site')
    );
    await new Promise<void>((resolve, reject) => {
      let tries = 0;
      const timer = setInterval(() => {
        const info: TransferInfo = JSON.parse(kit.transferInfo());
        if (info.running) {
          clearInterval(timer);
          transferInfo.value = info;
          resolve();
        } else if (info.message || ++tries > 100) {
          clearInterval(timer);
          reject(new Error(info.message || '开启时间较长，请重试'));
        }
      }, 100);
    });
    // #endif
    // #ifdef H5
    const result = await fetch('/__transfer/start', { method: 'POST' });
    const info = await result.json();
    if (!result.ok) throw new Error(info.message || '当前环境不能开启互传服务');
    transferInfo.value = info;
    // #endif
    await refreshTransfer();
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => void refreshTransfer(), 1200);
  } catch (error) {
    transferError.value = (error as Error).message;
  } finally {
    transferBusy.value = false;
  }
}
export async function stopTransfer() {
  clearInterval(refreshTimer);
  // #ifdef APP-PLUS
  nativeDevice()?.stopTransfer();
  // #endif
  // #ifdef H5
  await fetch('/__transfer/stop', { method: 'POST' });
  // #endif
  transferInfo.value = { running: false };
  transferProgress.value = [];
}
export async function refreshTransfer() {
  if (refreshing || !transferInfo.value.running) return;
  refreshing = true;
  try {
    const state = await request<{
      items: TransferItem[];
      transfers: TransferProgress[];
      peerCount: number;
      addresses?: string[];
    }>('/api/state');
    transferItems.value = state.items;
    transferProgress.value = state.transfers || [];
    transferInfo.value = {
      ...transferInfo.value,
      peerCount: state.peerCount,
      addresses: state.addresses || transferInfo.value.addresses
    };
    transferError.value = '';
  } catch (error) {
    transferError.value = (error as Error).message;
  } finally {
    refreshing = false;
  }
}
export async function sendText(text: string) {
  await request('/api/text', 'POST', { text });
  await refreshTransfer();
  toast('文字已分享，对方可以复制');
}
export async function readTransferText(item: TransferItem) {
  return (await request<{ text: string }>(`/api/items/${item.id}`)).text;
}
export async function cancelTransfer(id: string) {
  await request(`/api/cancel/${id}`, 'POST');
  await refreshTransfer();
}
export async function shareFiles() {
  // #ifdef APP-PLUS
  const kit = nativeDevice();
  if (!kit) throw nativeProblem();
  await runNativeOperation((value) => value.chooseFiles('share'));
  await refreshTransfer();
  // #endif
  // #ifdef H5
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.onchange = async () => {
    for (const file of Array.from(input.files || [])) {
      try {
        const result = await fetch(
          `/__transfer/proxy/api/files?name=${encodeURIComponent(file.name)}`,
          {
            method: 'POST',
            headers: {
              'x-ikun-token': transferInfo.value.ownerToken || '',
              'content-type': 'application/octet-stream'
            },
            body: file
          }
        );
        if (!result.ok) throw new Error((await result.json()).message);
      } catch (error) {
        transferError.value = (error as Error).message;
      }
    }
    await refreshTransfer();
  };
  input.click();
  // #endif
}
export async function saveTransferFile(item: TransferItem) {
  // #ifdef APP-PLUS
  const kit = nativeDevice();
  if (!kit) throw nativeProblem();
  const result = await runNativeOperation<{ status: string }>((value) => value.exportFile(item.id));
  if (result.status === 'completed') toast('文件已保存到所选位置');
  // #endif
  // #ifdef H5
  const response = await fetch(`/__transfer/proxy/api/items/${item.id}`, {
    headers: { 'x-ikun-token': transferInfo.value.ownerToken || '' }
  });
  if (!response.ok) throw new Error('文件暂时无法读取');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = item.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  // #endif
}
if (import.meta.hot) import.meta.hot.dispose(() => clearInterval(refreshTimer));
