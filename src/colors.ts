// Lightweight ANSI color helpers (no external dependency)
const RESET = '\u001b[0m';
const BOLD = '\u001b[1m';

export const bold = (s: string) => `${BOLD}${s}${RESET}`;
export const red = (s: string) => `\u001b[31m${s}${RESET}`;
export const green = (s: string) => `\u001b[32m${s}${RESET}`;
export const yellow = (s: string) => `\u001b[33m${s}${RESET}`;
export const cyan = (s: string) => `\u001b[36m${s}${RESET}`;

// Convenience aliases
export const error = red;
export const success = green;
export const warn = yellow;
export const info = cyan;

export default { bold, red, green, yellow, cyan, error, success, warn, info };
