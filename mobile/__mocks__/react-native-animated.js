function Value(v) { this._value = v }
const noop = jest.fn(() => ({ start: jest.fn() }))

const Animated = {
  Value,
  spring: noop,
  timing: noop,
  sequence: noop,
  parallel: noop,
  View: 'View',
  Text: 'Text',
  Image: 'Image',
}

module.exports = Animated
module.exports.default = Animated
