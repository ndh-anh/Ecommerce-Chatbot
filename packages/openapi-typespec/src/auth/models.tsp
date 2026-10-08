import "@typespec/http";
import "../common/scalars/scalars.tsp";

namespace Auth;

using TypeSpec.Http;

model LoginRequest {
    username: NonEmptyString;
    password: Password;
}

model RegisterRequest {
    username: NonEmptyString;
    email: Email;
    password: Password;
    name: NonEmptyString;
}

model AuthResponse {
    accessToken: string;
    refreshToken: string;
}

model RefreshTokenRequest {
    refreshToken: string;
}

model VerifyEmailRequest {
    email: Email;
    otp: string;
}

model ResendVerificationRequest {
    email: Email;
}

model UserProfile {
    id: NonEmptyString;
    email: Email;
    name: NonEmptyString;
}

model MessageResponse {
    message: string;
}

model AuthResponse200 {
    @statusCode statusCode: 200;
    @body body: AuthResponse;
}

model UserProfile200 {
    @statusCode statusCode: 200;
    @body body: UserProfile;
}

model MessageResponse200 {
    @statusCode statusCode: 200;
    @body body: MessageResponse;
}

model GoogleLoginRequest {
    idToken: NonEmptyString;
}
