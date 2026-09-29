export class CoverInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoverInputError';
  }
}
