import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PaletteEditor } from '../components/PaletteEditor'
import type { Palette } from '@engine/types'

// Mock the canvas context for testing
const mockCanvasContext = {
  drawImage: vi.fn(),
  getImageData: vi.fn(() => ({
    data: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]),
    width: 3,
    height: 1
  }))
}

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: vi.fn(() => mockCanvasContext)
})

describe('PaletteEditor Component', () => {
  const mockOnClose = vi.fn()
  const mockOnSave = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should not render when closed', () => {
    render(
      <PaletteEditor
        isOpen={false}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    )

    expect(screen.queryByText('Palette Editor')).not.toBeInTheDocument()
  })

  it('should render when open', () => {
    render(
      <PaletteEditor
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    )

    expect(screen.getByText('Palette Editor')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Custom Palette')).toBeInTheDocument()
    expect(screen.getByDisplayValue('16')).toBeInTheDocument()
  })

  it('should initialize with existing palette data', () => {
    const existingPalette: Palette = {
      name: 'Test Palette',
      colors: new Uint32Array([0xff000000, 0xffffffff, 0xffff0000]),
      maxColors: 3
    }

    render(
      <PaletteEditor
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        initialPalette={existingPalette}
      />
    )

    expect(screen.getByDisplayValue('Test Palette')).toBeInTheDocument()
    expect(screen.getByDisplayValue('3')).toBeInTheDocument()
    expect(screen.getByText('Colors (3/32)')).toBeInTheDocument()
  })

  it('should add new colors', async () => {
    render(
      <PaletteEditor
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    )

    const addButton = screen.getByText('Add Color')
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(screen.getByText('Colors (3/32)')).toBeInTheDocument()
    })
  })

  it('should remove colors', async () => {
    render(
      <PaletteEditor
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    )

    // Add a color first
    const addButton = screen.getByText('Add Color')
    fireEvent.click(addButton)

    await waitFor(() => {
      const removeButtons = screen.getAllByText('×')
      expect(removeButtons.length).toBeGreaterThan(0)

      // Click the first remove button
      fireEvent.click(removeButtons[0])
    })

    await waitFor(() => {
      expect(screen.getByText('Colors (2/32)')).toBeInTheDocument()
    })
  })

  it('should prevent removing the last color', () => {
    const singleColorPalette: Palette = {
      name: 'Single Color',
      colors: new Uint32Array([0xff000000]),
      maxColors: 1
    }

    render(
      <PaletteEditor
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        initialPalette={singleColorPalette}
      />
    )

    const removeButton = screen.getByText('×')
    expect(removeButton).toBeDisabled()
  })

  it('should call onSave with correct palette data', async () => {
    render(
      <PaletteEditor
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    )

    // Update name
    const nameInput = screen.getByDisplayValue('Custom Palette')
    fireEvent.change(nameInput, { target: { value: 'My Test Palette' } })

    // Add more colors to match the maxColors we want to set
    const addButton = screen.getByText('Add Color')
    fireEvent.click(addButton) // Now we have 3 colors
    fireEvent.click(addButton) // Now we have 4 colors
    fireEvent.click(addButton) // Now we have 5 colors
    fireEvent.click(addButton) // Now we have 6 colors
    fireEvent.click(addButton) // Now we have 7 colors
    fireEvent.click(addButton) // Now we have 8 colors

    // Update max colors
    const maxColorsInput = screen.getByDisplayValue('16')
    fireEvent.change(maxColorsInput, { target: { value: '8' } })

    // Save
    const saveButton = screen.getByText('Save Palette')
    fireEvent.click(saveButton)

    expect(mockOnSave).toHaveBeenCalledWith({
      name: 'My Test Palette',
      colors: expect.any(Uint32Array),
      maxColors: 8 // Now should be 8 since we have 8 colors and maxColors is 8
    })
  })

  it('should validate palette name before saving', async () => {
    // Mock alert
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    render(
      <PaletteEditor
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    )

    // Clear name
    const nameInput = screen.getByDisplayValue('Custom Palette')
    fireEvent.change(nameInput, { target: { value: '' } })

    // Try to save
    const saveButton = screen.getByText('Save Palette')
    fireEvent.click(saveButton)

    expect(alertSpy).toHaveBeenCalledWith('Please enter a palette name')
    expect(mockOnSave).not.toHaveBeenCalled()

    alertSpy.mockRestore()
  })

  it('should handle color updates', async () => {
    render(
      <PaletteEditor
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    )

    const colorInputs = screen.getAllByDisplayValue('#000000')
    expect(colorInputs.length).toBeGreaterThan(0)

    fireEvent.change(colorInputs[0], { target: { value: '#ff0000' } })

    // Verify the color was updated
    expect(screen.getByDisplayValue('#ff0000')).toBeInTheDocument()
  })

  it('should call onClose when cancel is clicked', () => {
    render(
      <PaletteEditor
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    )

    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should prevent adding more than 32 colors', async () => {
    // Create a palette with 32 colors
    const colors = new Array(32).fill(0).map((_, i) => 0xff000000 + i)
    const fullPalette: Palette = {
      name: 'Full Palette',
      colors: new Uint32Array(colors),
      maxColors: 32
    }

    render(
      <PaletteEditor
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        initialPalette={fullPalette}
      />
    )

    const addButton = screen.getByText('Add Color')
    expect(addButton).toBeDisabled()
  })
})
