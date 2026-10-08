import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GoogleLoginButton from "./GoogleLoginButton";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  setTokens: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  initialize: vi.fn(),
  renderButton: vi.fn(),
}));
vi.mock("@/utils/login", () => ({ loginWithGoogle: mocks.login }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock("@e-commerce/api-client/storages/token-storage", () => ({
  default: { setTokens: mocks.setTokens },
}));
vi.mock("next/script", () => ({
  default: ({ onReady }: { onReady: () => void }) => (
    <button onClick={onReady}>Load Google</button>
  ),
}));

afterEach(() => {
  cleanup();
  delete window.google;
});
beforeEach(() => {
  vi.clearAllMocks();
  window.google = {
    accounts: {
      id: { initialize: mocks.initialize, renderButton: mocks.renderButton },
    },
  };
});
async function credentialCallback() {
  render(
    <GoogleLoginButton clientId="real-client.apps.googleusercontent.com" />,
  );
  await act(async () => screen.getByText("Load Google").click());
  return mocks.initialize.mock.calls[0][0].callback;
}
describe("GoogleLoginButton", () => {
  it("shows a configuration message for the placeholder without loading Google", () => {
    render(
      <GoogleLoginButton clientId="replace-me.apps.googleusercontent.com" />,
    );
    expect(screen.getByText(/sau khi được cấu hình/)).toBeTruthy();
    expect(screen.queryByText("Load Google")).toBeNull();
  });
  it("exchanges the Google credential, stores the access token and navigates home", async () => {
    mocks.login.mockResolvedValue({ success: true, accessToken: "access" });
    const callback = await credentialCallback();
    await act(async () => callback({ credential: "google-id-token" }));
    expect(mocks.login).toHaveBeenCalledWith({ idToken: "google-id-token" });
    expect(mocks.setTokens).toHaveBeenCalledWith("access");
    expect(mocks.push).toHaveBeenCalledWith("/");
  });
  it("shows the API error and stays on login when the email already has an account", async () => {
    mocks.login.mockResolvedValue({
      success: false,
      message: "Vui lòng đăng nhập bằng mật khẩu.",
    });
    const callback = await credentialCallback();
    await act(async () => callback({ credential: "google-id-token" }));
    await waitFor(() =>
      expect(
        screen.getByText("Vui lòng đăng nhập bằng mật khẩu."),
      ).toBeTruthy(),
    );
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.setTokens).not.toHaveBeenCalled();
  });
});
