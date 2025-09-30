declare global {
  namespace JSX {
    interface IntrinsicElements {
      mesh: any;
      group: any;
      ambientLight: any;
      directionalLight: any;
      pointLight: any;
    }
  }
}

// Minimal type shim when @types/three is not present
declare module 'three';

export {};
