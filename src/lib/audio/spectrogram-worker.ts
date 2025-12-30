/**
 * Web Worker for spectrogram generation
 * Offloads heavy FFT computation to a separate thread
 */

// Inline FFT implementation (workers can't import modules easily)
function fft(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  if (n <= 1) return;

  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      const tempR = real[i];
      real[i] = real[j];
      real[j] = tempR;
      const tempI = imag[i];
      imag[i] = imag[j];
      imag[j] = tempI;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Cooley-Tukey FFT with precomputed twiddle factors
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wPrReal = Math.cos(angle);
    const wPrImag = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let wReal = 1;
      let wImag = 0;

      for (let j = 0; j < halfLen; j++) {
        const evenIdx = i + j;
        const oddIdx = evenIdx + halfLen;

        const tReal = wReal * real[oddIdx] - wImag * imag[oddIdx];
        const tImag = wReal * imag[oddIdx] + wImag * real[oddIdx];

        real[oddIdx] = real[evenIdx] - tReal;
        imag[oddIdx] = imag[evenIdx] - tImag;
        real[evenIdx] += tReal;
        imag[evenIdx] += tImag;

        const nextWReal = wReal * wPrReal - wImag * wPrImag;
        const nextWImag = wReal * wPrImag + wImag * wPrReal;
        wReal = nextWReal;
        wImag = nextWImag;
      }
    }
  }
}

interface SpectrogramRequest {
  channelData: Float32Array;
  sampleRate: number;
  fftSize: number;
  targetFrames: number;
}

interface SpectrogramResponse {
  frames: Float32Array; // Flattened 2D array
  numFrames: number;
  numBins: number;
}

self.onmessage = (e: MessageEvent<SpectrogramRequest>) => {
  const { channelData, fftSize, targetFrames } = e.data;

  const hopSize = Math.max(256, Math.floor((channelData.length - fftSize) / targetFrames));
  const numFrames = Math.floor((channelData.length - fftSize) / hopSize);
  const numBins = fftSize / 2;

  // Pre-compute Hanning window
  const hannWindow = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    hannWindow[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / fftSize));
  }

  // Allocate flat array for all frames
  const frames = new Float32Array(numFrames * numBins);

  // Reusable buffers
  const real = new Float32Array(fftSize);
  const imag = new Float32Array(fftSize);

  let maxMag = 0;

  for (let frame = 0; frame < numFrames; frame++) {
    const start = frame * hopSize;
    const frameOffset = frame * numBins;

    // Apply window and copy to real buffer
    for (let i = 0; i < fftSize; i++) {
      real[i] = (channelData[start + i] || 0) * hannWindow[i];
      imag[i] = 0;
    }

    fft(real, imag);

    // Compute magnitudes directly into output
    for (let i = 0; i < numBins; i++) {
      const mag = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
      frames[frameOffset + i] = mag;
      if (mag > maxMag) maxMag = mag;
    }
  }

  // Normalize with log scale in-place
  if (maxMag > 0) {
    const invMaxMag = 9 / maxMag;
    for (let i = 0; i < frames.length; i++) {
      frames[i] = Math.log10(1 + frames[i] * invMaxMag);
    }
  }

  const response: SpectrogramResponse = { frames, numFrames, numBins };
  self.postMessage(response, { transfer: [frames.buffer] });
};

export type { SpectrogramRequest, SpectrogramResponse };
