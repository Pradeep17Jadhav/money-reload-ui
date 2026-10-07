import { TextDecoder, TextEncoder } from "node:util";
import "@testing-library/jest-dom";

// jsdom does not expose the encoding globals, which the password byte-length
// rule needs in order to mirror the server's 72-byte cap.
if (typeof globalThis.TextEncoder === "undefined") {
  globalThis.TextEncoder = TextEncoder as typeof globalThis.TextEncoder;
}

if (typeof globalThis.TextDecoder === "undefined") {
  globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
}