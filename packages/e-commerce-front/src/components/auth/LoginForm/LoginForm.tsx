"use client";

import GoogleLoginButton from "./GoogleLoginButton";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";

import { useForm } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";
import TextField from "@/components/inputs/TextField/TextField";
import type { LoginRequest } from "@e-commerce/api-client/schemas/auth";
import type { LoginFormProps } from "@/components/auth/LoginForm/types";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { postLoginBody } from "@e-commerce/api-validation/zod/auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { login } from "@/utils/login";
import tokenStore from "@e-commerce/api-client/storages/token-storage";
import { useMutation } from "@tanstack/react-query";

export default function LoginForm({
  title = "Đăng nhập",
  mode,
  googleClientId,
}: LoginFormProps) {
  const { control, handleSubmit } = useForm<LoginRequest>({
    defaultValues: { username: "", password: "" },
    mode: "onSubmit",
    resolver: zodResolver(postLoginBody),
  });

  const mutation = useMutation({
    mutationFn: login,
  });

  const router = useRouter();

  const onSubmit: SubmitHandler<LoginRequest> = async (data) => {
    try {
      const result = await mutation.mutateAsync(data);
      if (result.success && result.accessToken) {
        tokenStore.setTokens(result.accessToken);
        router.push("/");
      } else {
        if (result.code === "USER_UNVERIFIED") {
          router.push(
            `/auth/verify-email?email=${encodeURIComponent(data.username)}`,
          );
        } else {
          throw new Error(result.message || "Đăng nhập thất bại");
        }
      }
    } catch {
      // Error state handled by mutation.isError
    }
  };

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      width="100%"
      minHeight="100vh"
      sx={{ px: 2 }}
    >
      <Paper sx={{ maxWidth: 480, width: "100%", p: 4 }} elevation={6}>
        <Typography variant="title" gutterBottom>
          {title}
        </Typography>

        {mutation.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {"Đăng nhập thất bại. Vui lòng thử lại."}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <TextField
            control={control}
            name="username"
            label="Email hoặc tên đăng nhập"
            fullWidth
            margin="normal"
            size="medium"
          />

          <TextField
            control={control}
            name="password"
            label="Mật khẩu"
            type="password"
            fullWidth
            margin="normal"
            size="medium"
          />

          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mt={1}
          >
            <Button
              color="primary"
              variant="text"
              onClick={() => {
                // navigate handled by parent pages via router; keep as noop here
                // parent pages will render links/buttons for register/reset
              }}
            >
              <Typography variant="regularS">Quên mật khẩu?</Typography>
            </Button>
          </Box>

          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, py: 1.5, borderRadius: 3 }}
            loading={mutation.isPending}
          >
            Đăng nhập
          </Button>

          {mode === "user" && (
            <>
              <GoogleLoginButton clientId={googleClientId} />

              <Box
                mt={2}
                display="flex"
                justifyContent="center"
                alignItems="center"
              >
                <Typography variant="regularS">Chưa có tài khoản?</Typography>
                <Button
                  sx={{ ml: 1 }}
                  variant="text"
                  component={Link}
                  href="/auth/register"
                >
                  Đăng ký
                </Button>
              </Box>
            </>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
