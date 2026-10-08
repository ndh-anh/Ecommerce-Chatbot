export type LoginFormProps = LoginWithUser | LoginWithAdmin;

type BaseProps = {
  title?: string;
  googleClientId?: string;
};

type LoginWithUser = BaseProps & {
  mode: "user";
};

type LoginWithAdmin = BaseProps & {
  mode: "admin";
};
