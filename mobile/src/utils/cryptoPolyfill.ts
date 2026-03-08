// Polyfill crypto.getRandomValues for crypto-js in React Native.
// Must be imported before any module that uses crypto-js.
import * as ExpoCrypto from 'expo-crypto';

if (typeof global.crypto === 'undefined') {
  (global as any).crypto = {};
}
if (typeof global.crypto.getRandomValues === 'undefined') {
  (global.crypto as any).getRandomValues = (array: Uint8Array) => {
    const bytes = ExpoCrypto.getRandomBytes(array.length);
    array.set(bytes);
    return array;
  };
}
