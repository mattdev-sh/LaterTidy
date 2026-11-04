/**
 * Synchronous SHA-1. crypto.subtle is async, and the pagehide flush has to build its
 * Authorization header without yielding, or the request never leaves the page.
 */
export function sha1Hex(message: string): string {
  const bytes = new TextEncoder().encode(message);
  const words = new Uint32Array((((bytes.length + 8) >> 6) + 1) * 16);
  bytes.forEach((b, i) => { words[i >> 2]! |= b << (24 - (i % 4) * 8); });
  words[bytes.length >> 2]! |= 0x80 << (24 - (bytes.length % 4) * 8);
  words[words.length - 1] = bytes.length * 8;

  const h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const w = new Int32Array(80);
  const rol = (x: number, n: number) => (x << n) | (x >>> (32 - n));
  for (let i = 0; i < words.length; i += 16) {
    let [a, b, c, d, e] = h as [number, number, number, number, number];
    for (let t = 0; t < 80; t++) {
      w[t] = t < 16 ? words[i + t]! : rol(w[t - 3]! ^ w[t - 8]! ^ w[t - 14]! ^ w[t - 16]!, 1);
      const [f, k] = t < 20 ? [(b & c) | (~b & d), 0x5a827999]
        : t < 40 ? [b ^ c ^ d, 0x6ed9eba1]
        : t < 60 ? [(b & c) | (b & d) | (c & d), 0x8f1bbcdc]
        : [b ^ c ^ d, 0xca62c1d6];
      const temp = (rol(a, 5) + f + e + k + w[t]!) | 0;
      e = d; d = c; c = rol(b, 30); b = a; a = temp;
    }
    h[0] = (h[0]! + a) | 0; h[1] = (h[1]! + b) | 0; h[2] = (h[2]! + c) | 0;
    h[3] = (h[3]! + d) | 0; h[4] = (h[4]! + e) | 0;
  }
  return h.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
}
