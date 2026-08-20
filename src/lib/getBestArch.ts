import * as Device from 'expo-device';

type ArchType = "arm64-v8a" | "x86_64" | "universal"

const getBestArch = (): ArchType => {
  const abis = Device.supportedCpuArchitectures;

    if (abis) {
      if (abis.includes('arm64-v8a')) {
        return 'arm64-v8a';
      }
      if (abis.includes('x86_64')) {
        return 'x86_64';
      }
    }

    // If the array is null or we don't have a specific split for their architecture,
    // safely fall back to the universal APK.
    return 'universal';
};

export default getBestArch;
