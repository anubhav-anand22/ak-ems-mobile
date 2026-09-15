import { PermissionsAndroid, Platform } from 'react-native';

export const requestStoragePermission = async () => {
  if (Platform.OS !== 'android') return true;

  try {
    // Check if permission is already granted
    const hasPermission = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
    );

    if (hasPermission) return true;

    // Request permission if not already granted
    const status = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      {
        title: 'Storage Permission Required',
        message: 'This app needs access to your storage to save files.',
        buttonPositive: 'OK',
      }
    );

    return status === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn('Storage permission error:', err);
    return false;
  }
};
