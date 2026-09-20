type Transport = { request: (request: any) => Promise<any>; cancel: (id: string) => void };
let transport: Transport | undefined;
export function setTransport(value: Transport) {
  transport = value;
}
export function getTransport(): Transport {
  if (!transport) throw new Error('Music transport is not initialized');
  return transport;
}
