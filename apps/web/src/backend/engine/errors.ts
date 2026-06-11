/** A typed error the UI can translate into a friendly toast. */
export class EngineError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
  }
}

export const fail = (code: string, message: string): never => {
  throw new EngineError(code, message);
};
