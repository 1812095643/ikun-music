import 'crypto-js';

declare module 'crypto-js' {
  namespace lib {
    type Mode = any;
  }
}

declare module 'tunajs';
