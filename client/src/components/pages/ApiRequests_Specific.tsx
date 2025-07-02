import { ApiRequest } from "./ApiRequest";
import apiClient from "./Client";

export class GetRecipesRequest extends ApiRequest<any> {
  url = "/api/recipes";
  method = "get";

  async execute(): Promise<any> {
    const response = await apiClient.get(this.url);
    return response.data;
  }
}

export class CreateRecipeRequest extends ApiRequest<any> {
  url = "/api/recipes";
  method = "post";

  async execute(): Promise<any> {
    const response = await apiClient.post(this.url, this.data);
    return response.data;
  }
}

export class RequestHandler {
  async execute<T>(request: ApiRequest<T>): Promise<T> {
    try {
      const response = await apiClient({
        url: request.url,
        method: request.method,
        headers: request.headers,
        data: request.data,
      });
      return response.data;
    } catch (error: any) {
      // Handle errors here (e.g., logging, retrying)
      throw error;
    }
  }
}
