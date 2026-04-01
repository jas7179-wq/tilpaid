import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.midlinedigital.tilpaid',
  appName: 'TilPaid',
  webDir: 'dist',
  server: {
    // Uncomment for live reload during development:
    // url: 'http://YOUR_LOCAL_IP:5173',
    // cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#3A7032',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#F7F9F4',
    },
    Haptics: {},
  },
  ios: {
    scheme: 'TilPaid',
    contentInset: 'automatic',
  },
  android: {
    backgroundColor: '#F7F9F4',
  },
};

export default config;
