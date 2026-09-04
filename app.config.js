const appJson = require('./app.json');

const androidAdMobAppId = process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID
  || 'ca-app-pub-3940256099942544~3347511713';
const iosAdMobAppId = process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID
  || 'ca-app-pub-3940256099942544~1458002511';

module.exports = {
  ...appJson,
  expo: {
    ...appJson.expo,
    plugins: [
      ...appJson.expo.plugins,
      ['react-native-google-mobile-ads', {
        androidAppId: androidAdMobAppId,
        iosAppId: iosAdMobAppId,
      }],
    ],
  },
};
