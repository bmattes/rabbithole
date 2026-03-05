const { View, Text, Image, ScrollView } = require('react-native')

const ReanimatedMock = {
  default: {
    View,
    Text,
    Image,
    ScrollView,
    createAnimatedComponent: (component) => component,
  },
  View,
  Text,
  Image,
  ScrollView,
  createAnimatedComponent: (component) => component,
  useSharedValue: (init) => ({ value: init }),
  useAnimatedStyle: () => ({}),
  withSpring: (value) => value,
  withTiming: (value) => value,
  withSequence: jest.fn(),
  withRepeat: jest.fn(),
  Easing: { out: jest.fn((x) => x), quad: jest.fn(), linear: jest.fn() },
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
}

module.exports = ReanimatedMock
