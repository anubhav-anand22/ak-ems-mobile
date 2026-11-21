const { withAndroidManifest } = require('expo/config-plugins');

const PERMISSIONS = [
  'android.permission.PACKAGE_USAGE_STATS',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.USE_FULL_SCREEN_INTENT',
  'android.permission.QUERY_ALL_PACKAGES',
];

const SERVICE_NAME = 'expo.modules.appexitwatcher.AppExitWatcherService';

function applyAppExitWatcherManifest(manifest) {
  if (!manifest) return manifest;

  // 1. Add permissions
  if (!manifest['uses-permission']) {
    manifest['uses-permission'] = [];
  }
  for (const permission of PERMISSIONS) {
    const exists = manifest['uses-permission'].some(
      (p) => p.$?.['android:name'] === permission
    );
    if (!exists) {
      const permObj = {
        $: { 'android:name': permission },
      };
      if (permission === 'android.permission.PACKAGE_USAGE_STATS') {
        permObj.$['tools:ignore'] = 'ProtectedPermissions';
      }
      if (permission === 'android.permission.QUERY_ALL_PACKAGES') {
        permObj.$['tools:ignore'] = 'QueryAllPackagesPermission';
      }
      manifest['uses-permission'].push(permObj);
    }
  }

  // 2. Ensure queries contains launcher intent query
  if (!manifest.queries) {
    manifest.queries = [];
  }
  const hasLauncherQuery = manifest.queries.some((q) =>
    q.intent?.some(
      (i) =>
        i.action?.some((a) => a.$?.['android:name'] === 'android.intent.action.MAIN') &&
        i.category?.some((c) => c.$?.['android:name'] === 'android.intent.category.LAUNCHER')
    )
  );
  if (!hasLauncherQuery) {
    manifest.queries.push({
      intent: [
        {
          action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
          category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
        },
      ],
    });
  }

  // 3. Ensure application tag has the service
  if (!manifest.application || manifest.application.length === 0) {
    manifest.application = [{ $: { 'android:name': '.MainApplication' }, service: [] }];
  }
  const application = manifest.application[0];
  if (!application.service) {
    application.service = [];
  }

  const existingServiceIndex = application.service.findIndex(
    (s) => s.$?.['android:name'] === SERVICE_NAME || s.$?.['android:name'] === '.AppExitWatcherService'
  );

  const serviceTag = {
    $: {
      'android:name': SERVICE_NAME,
      'android:exported': 'false',
      'android:foregroundServiceType': 'specialUse',
    },
    property: [
      {
        $: {
          'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE',
          'android:value': 'Automated payment tracking and expense entry',
        },
      },
    ],
  };

  if (existingServiceIndex >= 0) {
    application.service[existingServiceIndex] = serviceTag;
  } else {
    application.service.push(serviceTag);
  }

  return manifest;
}

function withAppExitWatcher(config) {
  return withAndroidManifest(config, (modConfig) => {
    modConfig.modResults.manifest = applyAppExitWatcherManifest(modConfig.modResults.manifest);
    return modConfig;
  });
}

withAppExitWatcher.applyAppExitWatcherManifest = applyAppExitWatcherManifest;
withAppExitWatcher.PERMISSIONS = PERMISSIONS;
withAppExitWatcher.SERVICE_NAME = SERVICE_NAME;

module.exports = withAppExitWatcher;
