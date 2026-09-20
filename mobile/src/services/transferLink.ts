export function parseTransferLink(content: string): string | null {
  // 只接收本软件局域网二维码，不能把任意二维码当作网址打开。
  const match = /^http:\/\/(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})\/?#code=(\d{6})$/.exec(
    content.trim()
  );
  if (!match) return null;
  const ip = match[1].split('.').map(Number);
  const port = Number(match[2]);
  if (ip.some((part) => part > 255) || port < 1 || port > 65535) return null;
  const privateAddress =
    ip[0] === 10 ||
    (ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31) ||
    (ip[0] === 192 && ip[1] === 168) ||
    (ip[0] === 169 && ip[1] === 254);
  if (!privateAddress) return null;
  return `http://${ip.join('.')}:${port}/#code=${match[3]}`;
}
