import { runModule } from '../engine/index';
import { getModuleById } from '../engine/registry';
import { globalSimilarityGuard } from '../engine/similarityGuard';

/**
 * Test script to verify similarity guard functionality
 */
function testSimilarityGuard() {
  console.log('Testing Similarity Guard...');

  // Reset the similarity guard for clean testing
  globalSimilarityGuard.reset();

  const planetModule = getModuleById('planet');
  if (!planetModule) {
    console.error('Planet module not found');
    return;
  }

  const baseParams = {
    spriteType: 'planet',
    archetype: 'lush',
    seed: 12345,
    size: 32,
    paletteName: 'SNES_32' as const,
    dither: 'bayer4' as const,
    quantizer: 'nearest' as const,
    outline: 1 as const,
    params: {}
  };

  console.log('Generating sprites without similarity guard...');
  const spritesWithoutGuard = [];
  for (let i = 0; i < 5; i++) {
    const sprite = runModule(planetModule, {
      ...baseParams,
      seed: baseParams.seed + i,
      useSimilarityGuard: false
    });
    spritesWithoutGuard.push(sprite);
  }

  console.log('Generating sprites with similarity guard...');
  globalSimilarityGuard.reset(); // Reset for fair comparison
  const spritesWithGuard = [];
  for (let i = 0; i < 5; i++) {
    const sprite = runModule(planetModule, {
      ...baseParams,
      seed: baseParams.seed + i,
      useSimilarityGuard: true
    });
    spritesWithGuard.push(sprite);
  }

  // Test signature generation
  console.log('Testing signature generation...');
  const signature1 = globalSimilarityGuard.generateSignature(spritesWithGuard[0], {});
  const signature2 = globalSimilarityGuard.generateSignature(spritesWithGuard[1], {});

  console.log('Signature 1 edge histogram length:', signature1.edgeHistogram.length);
  console.log('Signature 1 palette usage length:', signature1.paletteUsage.length);
  console.log('Signature 2 edge histogram length:', signature2.edgeHistogram.length);

  // Test similarity detection
  console.log('Testing similarity detection...');
  globalSimilarityGuard.reset();
  globalSimilarityGuard.addToHistory(signature1);
  const isSimilar = globalSimilarityGuard.isSimilar(signature2);
  console.log('Are signatures similar?', isSimilar);

  console.log('✅ Similarity Guard test completed');
  return {
    spritesWithoutGuard,
    spritesWithGuard,
    signatures: [signature1, signature2]
  };
}

// Export for use in browser console
(window as any).testSimilarityGuard = testSimilarityGuard;

export { testSimilarityGuard };
