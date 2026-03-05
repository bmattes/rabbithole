// Mock for react-native/Libraries/BatchedBridge/NativeModules
// jest-expo v54 calls .default on this, so we need to provide it
const nativeModules = {
  AlertManager: { alertWithArgs: jest.fn() },
  AsyncLocalStorage: {
    multiGet: jest.fn((keys, cb) => process.nextTick(() => cb(null, []))),
    multiSet: jest.fn((entries, cb) => process.nextTick(() => cb(null))),
    multiRemove: jest.fn((keys, cb) => process.nextTick(() => cb(null))),
    multiMerge: jest.fn((entries, cb) => process.nextTick(() => cb(null))),
    clear: jest.fn(cb => process.nextTick(() => cb(null))),
    getAllKeys: jest.fn(cb => process.nextTick(() => cb(null, []))),
  },
  DeviceInfo: {
    getConstants() {
      return {
        Dimensions: {
          screen: { width: 390, height: 844, scale: 3, fontScale: 1 },
          window: { width: 390, height: 844, scale: 3, fontScale: 1 },
        },
      }
    },
  },
  ImageLoader: {
    prefetchImage: jest.fn(),
    getSize: jest.fn((uri, success) => process.nextTick(() => success(320, 240))),
  },
  ImageViewManager: {
    prefetchImage: jest.fn(),
    getSize: jest.fn((uri, success) => process.nextTick(() => success(320, 240))),
  },
  Networking: {
    sendRequest: jest.fn(),
    abortRequest: jest.fn(),
    clearCookies: jest.fn(),
  },
  PlatformConstants: {
    getConstants() {
      return { isTesting: true, reactNativeVersion: { major: 0, minor: 76, patch: 0 } }
    },
  },
  StatusBarManager: { getHeight: jest.fn(), setColor: jest.fn(), setStyle: jest.fn(), setHidden: jest.fn() },
  Timing: { createTimer: jest.fn(), deleteTimer: jest.fn() },
  UIManager: { getViewManagerConfig: jest.fn(() => ({})), hasViewManagerConfig: jest.fn(() => false), createView: jest.fn(), setChildren: jest.fn(), manageChildren: jest.fn(), updateView: jest.fn(), dispatchViewManagerCommand: jest.fn(), measure: jest.fn(), measureInWindow: jest.fn(), measureLayout: jest.fn(), measureLayoutRelativeToParent: jest.fn(), setJSResponder: jest.fn(), clearJSResponder: jest.fn(), configureNextLayoutAnimation: jest.fn(), removeSubviews: jest.fn(), replaceExistingNonRootView: jest.fn() },
}

nativeModules.default = nativeModules
module.exports = nativeModules
