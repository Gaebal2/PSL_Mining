const appJson = require('./app.json');

const googleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

module.exports = {
  ...appJson,
  expo: {
    ...appJson.expo,
    plugins: [
      ...appJson.expo.plugins,
      ...(googleMapsApiKey
        ? [
            [
              'react-native-maps',
              {
                androidGoogleMapsApiKey: googleMapsApiKey,
              },
            ],
          ]
        : []),
    ],
  },
};
