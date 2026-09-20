export { Buffer } from 'buffer';
import { getTransport } from './transport';

export const window = {
  desktop: {
    lxMusicHttpRequest: (request: unknown) => getTransport().request(request),
    lxMusicHttpCancel: (id: string) => getTransport().cancel(id)
  }
};

export class DOMException extends Error {
  constructor(message: string, name = 'Error') {
    super(message);
    this.name = name;
  }
}
