"use server";

import {
  postLogin,
  postGoogleLogin,
} from "@e-commerce/api-client/endpoints/auth";
import type {
  PostLoginBody,
  PostGoogleLoginBody,
} from "@e-commerce/api-validation/types/auth";
import { cookies } from "next/headers";

export async function login(body: PostLoginBody) {
  try {
    const data = await postLogin(body);

    const cookieStore = await cookies();

    cookieStore.set("refresh_token", data.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return { success: true, accessToken: data.accessToken };
  } catch (error: any) {
    const code = error?.response?.data?.code || error?.code;
    const message = error?.response?.data?.message || error?.message;
    return { success: false, code, message };
  }
}

export async function loginWithGoogle(body: PostGoogleLoginBody) {
  try {
    const data = await postGoogleLogin(body);
    const cookieStore = await cookies();
    cookieStore.set("refresh_token", data.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return { success: true, accessToken: data.accessToken };
  } catch (error: any) {
    return {
      success: false,
      message: error?.response?.data?.message || "Đăng nhập Google thất bại.",
    };
  }
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("refresh_token");
}
