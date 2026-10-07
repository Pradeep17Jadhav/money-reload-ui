"use client";

import { useCallback, useMemo, useState } from "react";
import classnames from "classnames";
import Link from "next/link";
import { Checkbox, FormControlLabel } from "@mui/material";
import AuthPanel from "@/components/AuthPanel/AuthPanel";
import AuthField from "@/components/AuthField/AuthField";
import AuthSelectField from "@/components/AuthField/AuthSelectField";
import AuthRadioField from "@/components/AuthField/AuthRadioField";
import AvatarInitials from "@/components/AvatarInitials/AvatarInitials";
import { useAuth } from "@/contexts/authContext";
import { COUNTRIES } from "@/helpers/countries";
import { getInitials } from "@/helpers/initials";
import { getAuthErrorCopy, getRateLimitMessage } from "@/helpers/apiErrors";
import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  REGISTER_INITIAL_VALUES,
  USERNAME_MAX_LENGTH,
  getUnmetPasswordRules,
  hasErrors,
  validateRegisterForm,
} from "@/helpers/authValidation";
import type { RegisterFormValues } from "@/helpers/authValidation";
import type { Gender } from "@/types/AuthTypes";
import { PATHS } from "@/constants/path";

import styles from "./RegisterPanel.module.css";

type FieldName = keyof RegisterFormValues;

type TouchedState = Partial<Record<FieldName, boolean>>;

const RegisterPanel = () => {
  const { signUp, sessionRestoreMessage } = useAuth();

  const [values, setValues] = useState<RegisterFormValues>(REGISTER_INITIAL_VALUES);
  const [touched, setTouched] = useState<TouchedState>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [banner, setBanner] = useState<string | null>(sessionRestoreMessage);
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});

  const errors = useMemo(() => validateRegisterForm(values), [values]);
  const isValid = !hasErrors(errors);
  const initials = getInitials(values.firstName, values.lastName);

  const clearFieldError = useCallback((field: string) => {
    setServerFieldErrors((current) => {
      if (!(field in current)) {
        return current;
      }

      const { [field]: _removed, ...rest } = current;
      return rest;
    });
  }, []);

  const setField = useCallback(
    (field: FieldName, value: string | boolean) => {
      setValues((current) => ({ ...current, [field]: value }) as RegisterFormValues);
      setBanner(null);
      clearFieldError(field);
    },
    [clearFieldError]
  );

  const markTouched = useCallback((field: FieldName) => {
    setTouched((current) => (current[field] ? current : { ...current, [field]: true }));
  }, []);

  /** A field-attached error from the server wins over the mirrored local one. */
  const visibleError = useCallback(
    (field: FieldName): string | undefined =>
      serverFieldErrors[field] ?? ((touched[field] || hasSubmitted) ? errors[field] : undefined),
    [errors, hasSubmitted, serverFieldErrors, touched]
  );

  const unmetPasswordRules = getUnmetPasswordRules(values.password);

  const handleSubmit = useCallback(async () => {
    setHasSubmitted(true);
    setBanner(null);

    if (hasErrors(validateRegisterForm(values))) {
      return;
    }

    setIsSubmitting(true);
    setServerFieldErrors({});

    try {
      // Only the fields the contract lists are sent. The consent checkbox is
      // validated here and deliberately not transmitted, because any property
      // outside the contract is a rejection rather than something to ignore.
      await signUp({
        username: values.username,
        email: values.email,
        firstName: values.firstName,
        lastName: values.lastName,
        country: values.country.toUpperCase(),
        gender: values.gender as Gender,
        password: values.password,
      });
    } catch (error) {
      const copy = getAuthErrorCopy(error);
      setBanner(getRateLimitMessage(error) ?? copy.banner);
      setServerFieldErrors(copy.fields);
    } finally {
      setIsSubmitting(false);
    }
  }, [signUp, values]);

  const handleConsentChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setField("acceptedTerms", event.target.checked);
    },
    [setField]
  );

  return (
    <AuthPanel
      title="Create your account"
      subtitle="Start tracking your loans, income, expenses and goals."
      banner={banner}
      onSubmit={() => {
        void handleSubmit();
      }}
      isSubmitting={isSubmitting}
      isValid={isValid}
      submitLabel="create account"
      switchPrompt="Already have an account?"
      switchHref={PATHS.LOGIN}
      switchLabel="Sign in"
    >
      <div className={styles.preview}>
        <AvatarInitials initials={initials} size={56} />
        <span className={styles.previewText}>
          This is how you will appear
          <span className={styles.previewName}>
            {[values.firstName, values.lastName].filter(Boolean).join(" ") || "Your name"}
          </span>
        </span>
      </div>

      <div className={styles.nameRow}>
        <AuthField
          id="register-firstName"
          label="first name"
          value={values.firstName}
          onChange={(value) => setField("firstName", value)}
          onBlur={() => markTouched("firstName")}
          error={visibleError("firstName")}
          autoComplete="given-name"
          maxLength={NAME_MAX_LENGTH}
        />

        <AuthField
          id="register-lastName"
          label="last name"
          value={values.lastName}
          onChange={(value) => setField("lastName", value)}
          onBlur={() => markTouched("lastName")}
          error={visibleError("lastName")}
          autoComplete="family-name"
          maxLength={NAME_MAX_LENGTH}
        />
      </div>

      <AuthField
        id="register-username"
        label="username"
        value={values.username}
        onChange={(value) => setField("username", value)}
        onBlur={() => markTouched("username")}
        error={visibleError("username")}
        autoComplete="username"
        maxLength={USERNAME_MAX_LENGTH}
      />

      <AuthField
        id="register-email"
        label="email address"
        value={values.email}
        onChange={(value) => setField("email", value)}
        onBlur={() => markTouched("email")}
        error={visibleError("email")}
        type="email"
        inputMode="email"
        autoComplete="email"
        maxLength={EMAIL_MAX_LENGTH}
      />

      <AuthSelectField
        id="register-country"
        label="country"
        value={values.country}
        options={COUNTRIES}
        onChange={(value) => setField("country", value)}
        onBlur={() => markTouched("country")}
        error={visibleError("country")}
      />

      <AuthRadioField
        id="register-gender"
        label="gender"
        value={values.gender}
        onChange={(value) => setField("gender", value)}
        onBlur={() => markTouched("gender")}
        error={visibleError("gender")}
      />

      <AuthField
        id="register-password"
        label="password"
        value={values.password}
        onChange={(value) => setField("password", value)}
        onBlur={() => markTouched("password")}
        error={visibleError("password")}
        type="password"
        autoComplete="new-password"
        withVisibilityToggle
        helperText={
          unmetPasswordRules.length
            ? `Needs ${unmetPasswordRules.join(", ")}.`
            : "Password is long enough and mixes letters with numbers."
        }
      />

      <AuthField
        id="register-confirmPassword"
        label="confirm password"
        value={values.confirmPassword}
        onChange={(value) => setField("confirmPassword", value)}
        onBlur={() => markTouched("confirmPassword")}
        error={visibleError("confirmPassword")}
        type="password"
        autoComplete="new-password"
        withVisibilityToggle
      />

      <div>
        <FormControlLabel
          control={
            <Checkbox
              className={styles.consentCheckbox}
              id="register-acceptedTerms"
              checked={values.acceptedTerms}
              onChange={handleConsentChange}
              onBlur={() => markTouched("acceptedTerms")}
              inputProps={{
                "aria-describedby": visibleError("acceptedTerms")
                  ? "register-acceptedTerms-message"
                  : undefined,
              }}
            />
          }
          label={
            <span className={styles.consent}>
              I agree to the{" "}
              <Link href={PATHS.TERMS_AND_CONDITIONS}>terms and conditions</Link>
            </span>
          }
        />
        <p
          id="register-acceptedTerms-message"
          className={classnames(styles.consentMessage, {
            [styles.consentError]: !!visibleError("acceptedTerms"),
          })}
          aria-live="polite"
        >
          {visibleError("acceptedTerms") ?? " "}
        </p>
      </div>
    </AuthPanel>
  );
};

export default RegisterPanel;