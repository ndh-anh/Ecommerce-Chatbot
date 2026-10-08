import LoginForm from "@/components/auth/LoginForm/LoginForm";

// Read the public client ID at runtime, so Docker env changes do not require a frontend rebuild.
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <LoginForm mode="user" googleClientId={process.env.GOOGLE_CLIENT_ID} />
  );
}
