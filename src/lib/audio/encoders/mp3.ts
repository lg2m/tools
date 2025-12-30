import { createMp3Encoder } from "wasm-media-encoders";

export async function encodeMp3(audioBuffer: AudioBuffer, vbrQuality = 2): Promise<Blob> {
  const encoder = await createMp3Encoder();

  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;

  encoder.configure({
    sampleRate,
    channels: numChannels as 1 | 2,
    vbrQuality,
  });

  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(audioBuffer.getChannelData(i));
  }

  const chunkSize = 1152 * 100;
  const chunks: Uint8Array[] = [];

  for (let offset = 0; offset < audioBuffer.length; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, audioBuffer.length);
    const chunkChannels = channels.map((ch) => ch.slice(offset, end));

    const encoded = encoder.encode(chunkChannels);
    if (encoded.length > 0) {
      chunks.push(new Uint8Array(encoded));
    }
  }

  const final = encoder.finalize();
  if (final.length > 0) {
    chunks.push(new Uint8Array(final));
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let resultOffset = 0;
  for (const chunk of chunks) {
    result.set(chunk, resultOffset);
    resultOffset += chunk.length;
  }

  return new Blob([result], { type: "audio/mpeg" });
}
