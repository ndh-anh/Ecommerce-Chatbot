import TextField from "@mui/material/TextField";
import type { BaseTextFieldProps } from "./types";
import type { FieldValues } from "react-hook-form";

function BaseTextField<TField extends FieldValues>({
  field,
  fieldError,
  ...props
}: BaseTextFieldProps<TField>) {
  return (
    <TextField
      value={field?.value ?? ""}
      error={!!fieldError}
      onChange={field?.onChange}
      onBlur={field?.onBlur}
      ref={field?.ref}
      {...props}
      helperText={fieldError?.message || props.helperText}
    />
  );
}

export default BaseTextField;
