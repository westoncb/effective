/// <reference types="vite/client" />

declare module "*.csd?raw" {
  const source: string;
  export default source;
}
