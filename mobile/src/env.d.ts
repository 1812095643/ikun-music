/// <reference types="@dcloudio/types" />
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent;
  export default component;
}
declare module '@ikun/music-backend' {
  export function run(operation: string, input?: Record<string, unknown>): Promise<any>;
  export function setTransport(value: {
    request: (request: any) => Promise<any>;
    cancel: (id: string) => void;
  }): void;
}
declare const plus: any;
