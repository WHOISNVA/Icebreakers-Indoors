import '@react-three/fiber'

declare module '@react-three/fiber' {
  namespace JSX {
    interface IntrinsicElements {
      mesh: any
      group: any
      ambientLight: any
      directionalLight: any
      pointLight: any
    }
  }
}
