// Validates uploaded file content by magic bytes rather than trusting the
// client-supplied filename/extension or Content-Type, which are both
// attacker-controlled and can be used to smuggle HTML/SVG/script content
// into a web-servable public/uploads/** path (stored XSS).

const IMAGE_SIGNATURES: { ext: string; check: (buf: Buffer) => boolean }[] = [
  { ext: 'jpg', check: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'png', check: (b) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'gif', check: (b) => b.length >= 6 && (b.subarray(0, 6).toString('ascii') === 'GIF87a' || b.subarray(0, 6).toString('ascii') === 'GIF89a') },
  { ext: 'webp', check: (b) => b.length >= 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP' },
];

export function detectImageExtension(buffer: Buffer): string | null {
  const match = IMAGE_SIGNATURES.find((sig) => sig.check(buffer));
  return match ? match.ext : null;
}

export function isLikelyVideoFile(buffer: Buffer): boolean {
  // MP4/MOV family: 'ftyp' box at offset 4. WebM/MKV: EBML header.
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') return true;
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return true;
  return false;
}
