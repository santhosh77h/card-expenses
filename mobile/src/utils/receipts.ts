import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

export const RECEIPTS_DIR = `${FileSystem.documentDirectory}receipts/`;

export async function ensureReceiptsDir() {
  const info = await FileSystem.getInfoAsync(RECEIPTS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(RECEIPTS_DIR, { intermediates: true });
  }
}

export async function pickReceiptImage(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
    allowsEditing: true,
  });
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

export async function captureReceiptPhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchCameraAsync({
    quality: 0.8,
    allowsEditing: true,
  });
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

export async function saveReceipt(sourceUri: string, txnId: string): Promise<string> {
  await ensureReceiptsDir();
  const ext = sourceUri.split('.').pop() || 'jpg';
  const destUri = `${RECEIPTS_DIR}${txnId}.${ext}`;
  await FileSystem.copyAsync({ from: sourceUri, to: destUri });
  return destUri;
}

export async function deleteReceipt(receiptUri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(receiptUri);
  if (info.exists) {
    await FileSystem.deleteAsync(receiptUri);
  }
}
