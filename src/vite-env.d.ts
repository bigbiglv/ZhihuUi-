/// <reference types="vite/client" />

declare module '*?script' {
  const content: string
  export default content
}

declare module '*?script&module' {
  const content: string
  export default content
}
