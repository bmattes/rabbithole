// Runs after jest framework is loaded — safe to use jest.mock here

function AnimatedValue(v) { this._value = v }
const animNoop = jest.fn(() => ({ start: jest.fn() }))
const AnimatedMock = {
  Value: AnimatedValue,
  spring: animNoop,
  timing: animNoop,
  sequence: animNoop,
  parallel: animNoop,
  View: 'View',
  Text: 'Text',
  Image: 'Image',
}

jest.mock('react-native/Libraries/Animated/Animated', () => ({
  default: AnimatedMock,
  ...AnimatedMock,
}))
