/**
 * Fast Fourier Transform implementation using Cooley-Tukey algorithm
 * Converts time-domain signal to frequency-domain
 * O(n log n) complexity - much faster than naive O(n²) DFT
 */

/**
 * In-place FFT for power-of-2 sized arrays
 * @param real - Real part of complex numbers (modified in-place)
 * @param imag - Imaginary part of complex numbers (modified in-place)
 */
export function fft(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  if (n <= 1) return;

  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      // Swap real parts
      const tempR = real[i];
      real[i] = real[j];
      real[j] = tempR;
      // Swap imaginary parts
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

  // Cooley-Tukey FFT
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angle = (-2 * Math.PI) / len;

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

        const nextWReal = wReal * Math.cos(angle) - wImag * Math.sin(angle);
        const nextWImag = wReal * Math.sin(angle) + wImag * Math.cos(angle);
        wReal = nextWReal;
        wImag = nextWImag;
      }
    }
  }
}

/**
 * Compute magnitude spectrum from windowed audio data
 * @param windowedData - Time-domain audio samples (must be power-of-2 length)
 * @returns Magnitude spectrum (half the input length)
 */
export function computeMagnitudeSpectrum(
  windowedData: Float32Array,
): Float32Array {
  const fftSize = windowedData.length;
  const real = new Float32Array(windowedData);
  const imag = new Float32Array(fftSize);

  fft(real, imag);

  // Compute magnitudes for positive frequencies only
  const magnitudes = new Float32Array(fftSize / 2);
  for (let i = 0; i < magnitudes.length; i++) {
    magnitudes[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
  }

  return magnitudes;
}
