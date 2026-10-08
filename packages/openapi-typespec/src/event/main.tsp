import "@typespec/http";
import "@typespec/versioning";
import "./routes.tsp";
import "../common/enums/versions.tsp";
using Versioning;
using TypeSpec.Http;
@service(#{ title: "Event API" })
@versioned(Versions)
@route(CurrentRouteVersion)
namespace Event;
