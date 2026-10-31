import { ApiRequest } from "./ApiRequest";
import apiClient from "./Client";
import type { RecipeModel } from "../../types";

export class GetRecipesRequest extends ApiRequest<RecipeModel[]> {
  url = "/api/recipes";
  method = "get";

  async execute(): Promise<RecipeModel[]> {
    const response = await apiClient.get<RecipeModel[]>(this.url);
    return response.data;
  }
}

export class CreateRecipeRequest extends ApiRequest<unknown> {
  url = "/api/recipes";
  method = "post";

  async execute(): Promise<unknown> {
    const response = await apiClient.post<unknown>(this.url, this.data);
    return response.data;
  }
}

export class RequestHandler {
  async execute<T>(request: ApiRequest<T>): Promise<T> {
    const response = await apiClient.request<T>({
      url: request.url,
      method: request.method,
      headers: request.headers,
      data: request.data,
    });
    return response.data;
  }
}
