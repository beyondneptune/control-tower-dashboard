// Last path segment (folder/storage path → filename) for evidence display.
export const basename = (p: string): string => (p || "").split(/[\\/]/).pop() || p;
