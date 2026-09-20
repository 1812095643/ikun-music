import { deviceMode } from '@/stores/device';
import { toast } from '@/stores/library';

import { runNativeOperation } from './nativeDevice';
import { parseTransferLink } from './transferLink';

export function canScanTransfer() {
  // #ifdef APP-PLUS
  return true;
  // #endif
  // #ifndef APP-PLUS
  return false;
  // #endif
}

export async function scanTransferCode() {
  if (deviceMode.value === 'car') return;
  // #ifdef APP-PLUS
  let content = '';
  if (plus.os.name === 'Android') {
    const result = await runNativeOperation<{ content?: string }>((kit) => kit.scanCode());
    content = result.content || '';
  } else {
    content = await new Promise<string>((resolve, reject) =>
      uni.scanCode({
        onlyFromCamera: true,
        scanType: ['qrCode'],
        success: (result) => resolve(result.result),
        fail: (error) =>
          /cancel/i.test(error.errMsg)
            ? resolve('')
            : reject(new Error('暂时无法打开相机，请检查相机权限。'))
      })
    );
  }
  if (!content) return;
  const address = parseTransferLink(content);
  if (!address) throw new Error('请扫描 ikun音乐「局域网互传」页面的二维码。');
  // 复用已有浏览器传输客户端及自动配对，不在 WebView 中执行另一台设备的页面代码。
  plus.runtime.openURL(address, () => toast('未能打开互传页面，请检查默认浏览器。'));
  // #endif
}
