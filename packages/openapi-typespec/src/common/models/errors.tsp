import "@typespec/http";

using TypeSpec.Http;

model ErrorResponse {
    code: string;
    message: string;
}

@error
model UnauthorizedError {
    @statusCode statusCode: 401;
    @body body: ErrorResponse;
}

@error
model ForbiddenError {
    @statusCode statusCode: 403;
    @body body: ErrorResponse;
}

@error
model NotFoundError {
    @statusCode statusCode: 404;
    @body body: ErrorResponse;
}

@error
model BadRequestError {
    @statusCode statusCode: 400;
    @body body: ErrorResponse;
}

@error
model InternalServerError {
    @statusCode statusCode: 500;
    @body body: ErrorResponse;
}

@error
model ServiceUnavailableError {
    @statusCode statusCode: 503;
    @body body: ErrorResponse;
}
