/// <reference types="vite/client" />

import { IPC } from '../types';

declare global {
  interface Window {
    electronAPI: IPC;
  }
}
