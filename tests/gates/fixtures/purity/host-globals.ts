export const bytes = (): Uint8Array => crypto.getRandomValues(new Uint8Array(8));

export const later = (run: () => void): void => {
  setTimeout(run, 0);
};

export const repeatedly = (run: () => void): void => {
  setInterval(run, 0);
};

export const cwd = (): string => process.cwd();
