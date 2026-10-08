import "@typespec/http";
import "@typespec/openapi";
import "./models.tsp";
import "../../common/models/errors.tsp";

using TypeSpec.Http;
using TypeSpec.OpenAPI;

@route("/search")
namespace Product.Search {
    @get
    @route("")
    @operationId("searchProducts")
    @tag("search")
    @extension("x-public", true)
    op searchProducts(
        ...SearchProductRequestParams,
    ): SearchProductsResponse200 | BadRequestError | InternalServerError;
}
