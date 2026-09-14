import type { MessageApi } from 'naive-ui';

import { isDesktopRuntime } from '@/utils';

/**
 * 选择目录
 * @param message MessageApi 实例
 * @returns Promise<string | undefined> 返回选择的目录路径，如果取消则返回 undefined
 */
export const selectDirectory = async (message: MessageApi): Promise<string | undefined> => {
  if (!isDesktopRuntime || !window.desktop) {
    message.info('当前环境暂不支持选择目录');
    return undefined;
  }

  try {
    const result = await window.desktop.invoke('select-directory');
    if (result.filePaths?.[0]) {
      return result.filePaths[0];
    }
  } catch (error) {
    console.error('选择目录失败:', error);
    message.error('选择目录失败');
  }
  return undefined;
};

/**
 * 打开目录
 * @param path 要打开的目录路径
 * @param message MessageApi 实例
 * @param showTip 是否显示提示信息
 */
export const openDirectory = (path: string | undefined, message: MessageApi, showTip = true) => {
  if (!isDesktopRuntime || !window.desktop) {
    if (showTip) message.info('当前环境暂不支持打开目录');
    return;
  }

  if (path) {
    window.desktop.send('open-directory', path);
  } else if (showTip) {
    message.info('目录不存在');
  }
};
