import { Injectable } from '@nestjs/common';
import { SearchService } from './search.service';
import { BaseSearchControllerInterface } from '@generated-controller/product/search/base-search.controller.interface';
import type {
  SearchProductsQueryParams,
  SearchProducts200Response,
  SuggestSearchKeywordsQueryParams,
  SuggestSearchKeywords200Response,
} from '@e-commerce/api-validation/types/product';

@Injectable()
export class SearchController implements BaseSearchControllerInterface {
  constructor(private readonly service: SearchService) {}

  /** GET /api/v1/search/suggestions */
  async suggestSearchKeywords(
    query: SuggestSearchKeywordsQueryParams,
  ): Promise<SuggestSearchKeywords200Response> {
    return this.service.suggestSearchKeywords(query);
  }

  /**
   * GET /api/v1/search
   */
  async searchProducts(
    query: SearchProductsQueryParams,
  ): Promise<SearchProducts200Response> {
    return await this.service.searchProducts(query);
  }
}
