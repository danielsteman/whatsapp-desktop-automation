declare global {
  const Deno: {
    readTextFileSync(path: string): string;
    writeTextFileSync(path: string, data: string): void;
    removeSync(path: string): void;
    existsSync(path: string): boolean;
    readTextFile(path: string): Promise<string>;
    writeTextFile(path: string, data: string): Promise<void>;
    remove(path: string): Promise<void>;
    stat(path: string): Promise<{ isFile: boolean; isDirectory: boolean }>;
  };
}

export {};
