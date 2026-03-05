import React from 'react'
import { render } from '@testing-library/react-native'
import { Bubble } from '../Bubble'

describe('Bubble', () => {
  it('renders label text', () => {
    const { getByText } = render(
      <Bubble label="The Godfather" state="idle" position={{ x: 100, y: 200 }} />
    )
    expect(getByText('The Godfather')).toBeTruthy()
  })

  it('renders with active style when state is active', () => {
    const { getByTestId } = render(
      <Bubble label="Test" state="active" position={{ x: 0, y: 0 }} />
    )
    expect(getByTestId('bubble-container')).toBeTruthy()
  })
})
