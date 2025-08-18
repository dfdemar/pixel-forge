import React, { useState, useEffect } from 'react';
import type { Palette } from '@engine/types';

interface PaletteEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (palette: Palette) => void;
  initialPalette?: Palette;
}

/**
 * Palette Editor Component - Allows users to create and edit custom color palettes
 */
export function PaletteEditor({ isOpen, onClose, onSave, initialPalette }: PaletteEditorProps) {
  const [name, setName] = useState('');
  const [colors, setColors] = useState<string[]>([]);
  const [maxColors, setMaxColors] = useState(16);

  useEffect(() => {
    if (initialPalette) {
      setName(initialPalette.name);
      setMaxColors(initialPalette.maxColors);
      // Convert ARGB to hex colors
      const hexColors = Array.from(initialPalette.colors).map(argb => {
        const r = (argb >>> 16) & 0xff;
        const g = (argb >>> 8) & 0xff;
        const b = argb & 0xff;
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      });
      setColors(hexColors);
    } else {
      // Initialize with default values
      setName('Custom Palette');
      setMaxColors(16);
      setColors(['#000000', '#ffffff']);
    }
  }, [initialPalette, isOpen]);

  const addColor = () => {
    if (colors.length < 32) { // Maximum 32 colors
      setColors([...colors, '#808080']);
    }
  };

  const removeColor = (index: number) => {
    if (colors.length > 1) { // Keep at least one color
      setColors(colors.filter((_, i) => i !== index));
    }
  };

  const updateColor = (index: number, newColor: string) => {
    const newColors = [...colors];
    newColors[index] = newColor;
    setColors(newColors);
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert('Please enter a palette name');
      return;
    }

    if (colors.length === 0) {
      alert('Please add at least one color');
      return;
    }

    // Convert hex colors to ARGB
    const argbColors = colors.map(hex => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return (0xff << 24) | (r << 16) | (g << 8) | b;
    });

    const palette: Palette = {
      name: name.trim(),
      colors: new Uint32Array(argbColors),
      maxColors: Math.min(maxColors, colors.length)
    };

    onSave(palette);
    onClose();
  };

  const importFromImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        const colorSet = new Set<string>();

        // Extract unique colors
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const alpha = pixels[i + 3];

          if (alpha > 128) { // Skip mostly transparent pixels
            const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            colorSet.add(hex);
          }
        }

        const extractedColors = Array.from(colorSet).slice(0, 32); // Limit to 32 colors
        setColors(extractedColors);
        setName(`Extracted_${Date.now()}`);
      };

      img.src = URL.createObjectURL(file);
    };
    input.click();
  };

  if (!isOpen) return null;

  return (
    <div className="palette-editor-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="palette-editor" style={{
        backgroundColor: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '24px',
        width: '500px',
        maxWidth: '90vw',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <div className="h1" style={{ marginBottom: '16px' }}>Palette Editor</div>

        <label className="label">Palette Name</label>
        <input
          className="input"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Enter palette name"
          style={{ marginBottom: '16px' }}
        />

        <label className="label">Max Colors (for generation)</label>
        <input
          className="input"
          type="number"
          min="1"
          max="32"
          value={maxColors}
          onChange={e => setMaxColors(parseInt(e.target.value) || 16)}
          style={{ marginBottom: '16px' }}
        />

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button className="button small" onClick={addColor} disabled={colors.length >= 32}>
            Add Color
          </button>
          <button className="button small" onClick={importFromImage}>
            Import from Image
          </button>
        </div>

        <div className="label">Colors ({colors.length}/32)</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
          gap: '8px',
          marginBottom: '24px',
          maxHeight: '200px',
          overflowY: 'auto',
          border: '1px solid var(--border)',
          padding: '8px',
          borderRadius: '4px'
        }}>
          {colors.map((color, index) => (
            <div key={index} style={{ position: 'relative' }}>
              <input
                type="color"
                value={color}
                onChange={e => updateColor(index, e.target.value)}
                style={{
                  width: '100%',
                  height: '40px',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              />
              <button
                onClick={() => removeColor(index)}
                disabled={colors.length <= 1}
                style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button className="button" onClick={onClose}>Cancel</button>
          <button className="button" onClick={handleSave}>Save Palette</button>
        </div>
      </div>
    </div>
  );
}
