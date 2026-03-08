// Allow importing .tflite model files as Metro asset references
declare module '*.tflite' {
  const value: number;
  export default value;
}
