import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.midlinedigital.tilpaid',
  appName: 'TilPaid',
  webDir: 'dist',
  server: {
    // Remove this block for production builds
    // url: 'http://localhost:5173',
    // cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#2DBF7E',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#F8F9FA',
    },
    Haptics: {
      // Uses defaults
    },
  },
  ios: {
    scheme: 'TilPaid',
    contentInset: 'automatic',
  },
  android: {
    backgroundColor: '#F8F9FA',
  },
};

export default config;
