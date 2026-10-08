// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginWithGoogle } from "./login";
const mocks = vi.hoisted(() => ({ postGoogleLogin: vi.fn(), set: vi.fn() }));
vi.mock("@e-commerce/api-client/endpoints/auth", () => ({
  postGoogleLogin: mocks.postGoogleLogin,
  postLogin: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.set }) }));
beforeEach(() => vi.clearAllMocks());
describe("loginWithGoogle server action", () => {
  it("keeps the refresh token in an HTTP-only cookie and returns only the access token", async () => {
    mocks.postGoogleLogin.mockResolvedValue({
      accessToken: "access",
      refreshToken: "refresh",
    });
    expect(await loginWithGoogle({ idToken: "credential" })).toEqual({
      success: true,
      accessToken: "access",
    });
    expect(mocks.set).toHaveBeenCalledWith(
      "refresh_token",
      "refresh",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
  });
  it("returns the authentication error without setting a session cookie", async () => {
    mocks.postGoogleLogin.mockRejectedValue({
      response: { data: { message: "Invalid Google token" } },
    });
    expect(await loginWithGoogle({ idToken: "invalid" })).toEqual({
      success: false,
      message: "Invalid Google token",
    });
    expect(mocks.set).not.toHaveBeenCalled();
  });
});
