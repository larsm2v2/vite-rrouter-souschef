export abstract class ApiRequest<T> {
  abstract url: string;
  abstract method: string;
  headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  data: unknown;

  constructor(data?: unknown) {
    this.data = data;
  }

  abstract execute(): Promise<T>;
}
