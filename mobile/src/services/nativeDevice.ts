let kit: any;
let checked = false;
export function nativeDevice(): any | null {
  // #ifdef APP-PLUS
  if (plus.os.name === 'Android') {
    if (checked && !kit) return null;
    try {
      if (!kit) {
        checked = true;
        const candidate: any = plus.android.importClass('cn.ikun.music.device.DeviceKit');
        if (candidate.version() !== '1') return null;
        candidate.initialize(plus.android.runtimeMainActivity());
        kit = candidate;
      }
      kit.initialize(plus.android.runtimeMainActivity());
      return kit;
    } catch {
      kit = undefined;
      return null;
    }
  }
  // #endif
  return null;
}
export function nativeProblem() {
  return new Error('当前安装包尚未包含车机扩展，请使用包含本地扩展的新安装包。');
}
let fileOperationBusy = false;
export async function runNativeOperation<T>(start: (kit: any) => void): Promise<T> {
  if (fileOperationBusy) throw new Error('另一个文件操作正在进行，请稍后再试。');
  const value = nativeDevice();
  if (!value) throw nativeProblem();
  fileOperationBusy = true;
  try {
    start(value);
    return await waitNativeOperation<T>();
  } finally {
    fileOperationBusy = false;
  }
}
export async function waitNativeOperation<T>(): Promise<T> {
  const value = nativeDevice();
  if (!value) throw nativeProblem();
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      try {
        const result = JSON.parse(value.operationState());
        if (result.status === 'working' || result.status === 'idle') return;
        clearInterval(timer);
        if (result.status === 'error') reject(new Error(result.message));
        else resolve(result);
      } catch (error) {
        clearInterval(timer);
        reject(error);
      }
    }, 300);
  });
}
