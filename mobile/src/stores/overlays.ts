const closers = new Set<() => void>();

export function registerSheet(close: () => void) {
  closers.add(close);
  return () => {
    closers.delete(close);
  };
}

export function closeTopSheet() {
  const stack = Array.from(closers);
  const close = stack[stack.length - 1];
  if (!close) return false;
  // 系统返回优先关闭最上层菜单，避免外观、字号弹层把整个设置页面一起关闭。
  closers.delete(close);
  close();
  return true;
}
