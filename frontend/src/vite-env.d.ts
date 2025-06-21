/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND: string
  readonly VITE_BACKEND_TWO: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 