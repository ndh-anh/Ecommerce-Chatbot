"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { useRouter } from "next/navigation";
import { loginWithGoogle } from "@/utils/login";
import tokenStore from "@e-commerce/api-client/storages/token-storage";

type GoogleIdentity = {
  initialize: (options: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    auto_select: boolean;
  }) => void;
  renderButton: (
    element: HTMLElement,
    options: {
      theme: string;
      size: string;
      text: string;
      locale: string;
      width: number;
    },
  ) => void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}

export default function GoogleLoginButton({ clientId }: { clientId?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const configured = !!clientId && !clientId.startsWith("replace-me");

  useEffect(() => {
    if (!ready || !configured || !container.current || !window.google) return;
    const element = container.current;
    window.google.accounts.id.initialize({
      client_id: clientId!,
      auto_select: false,
      callback: async ({ credential }) => {
        if (busy.current) return;
        busy.current = true;
        setPending(true);
        setError("");
        try {
          const result = await loginWithGoogle({ idToken: credential });
          if (!result.success || !result.accessToken) {
            setError(
              result.message || "Đăng nhập Google thất bại. Vui lòng thử lại.",
            );
            return;
          }
          tokenStore.setTokens(result.accessToken);
          router.push("/");
          router.refresh();
        } catch {
          setError("Không thể đăng nhập Google. Vui lòng thử lại.");
        } finally {
          busy.current = false;
          setPending(false);
        }
      },
    });
    window.google.accounts.id.renderButton(element, {
      theme: "outline",
      size: "large",
      text: "signin_with",
      locale: "vi",
      width: Math.min(400, element.clientWidth || 320),
    });
    return () => {
      element.replaceChildren();
    };
  }, [ready, clientId, configured, router]);

  if (!configured)
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        Đăng nhập Google sẽ khả dụng sau khi được cấu hình.
      </Alert>
    );

  return (
    <Box sx={{ mt: 2 }}>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
        onError={() => setError("Không tải được Google. Vui lòng thử lại.")}
      />
      <Box
        ref={container}
        sx={{
          display: "flex",
          justifyContent: "center",
          pointerEvents: pending ? "none" : "auto",
          opacity: pending ? 0.5 : 1,
        }}
      />
      {!ready && !error && (
        <CircularProgress size={20} aria-label="Đang tải Google" />
      )}
      {pending && <CircularProgress size={20} aria-label="Đang đăng nhập" />}
      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
}
