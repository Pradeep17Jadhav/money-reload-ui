import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegisterPanel from "@/components/RegisterPanel/RegisterPanel";
import { useAuth } from "@/contexts/authContext";
import { AuthErrorCode, Gender } from "@/types/AuthTypes";
import { createApiError, createAuthResult } from "@/tests/factories/authFactories";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock("@/contexts/authContext", () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = useAuth as unknown as jest.Mock;
const signUp = jest.fn();

// Nine fields, and a MUI Select that has to open a portal: typing the whole
// form out is slower than Jest's default allowance.
jest.setTimeout(30000);

const renderPanel = () => {
  const user = userEvent.setup();
  render(<RegisterPanel />);
  return user;
};

const submitButton = () => screen.getByRole("button", { name: "create account" });

const PASSWORD = "abc12345";

/** Everything the contract requires, in the order the fields appear. */
const fillValidForm = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText("first name"), "Probe");
  await user.type(screen.getByLabelText("last name"), "One");
  await user.type(screen.getByLabelText("username"), "probe1");
  await user.type(screen.getByLabelText("email address"), "probe1@example.com");
  await user.click(screen.getByRole("combobox", { name: "country" }));
  await user.click(await screen.findByRole("option", { name: "India" }));
  await user.click(screen.getByRole("radio", { name: "other" }));
  await user.type(screen.getByLabelText("password"), PASSWORD);
  await user.type(screen.getByLabelText("confirm password"), PASSWORD);
  await user.click(screen.getByRole("checkbox"));
};

describe("RegisterPanel", () => {
  beforeEach(() => {
    signUp.mockReset();
    mockUseAuth.mockReturnValue({
      status: "unauthenticated",
      user: null,
      isSignedIn: false,
      sessionRestoreMessage: null,
      signIn: jest.fn(),
      signUp,
      signOut: jest.fn(),
    });
  });

  it("renders the form with submit disabled until it is valid", () => {
    renderPanel();

    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it("keeps the terms link in the consent row", () => {
    renderPanel();

    expect(screen.getByRole("link", { name: "terms and conditions" })).toHaveAttribute(
      "href",
      "/terms-and-conditions"
    );
  });

  describe("avatar initials", () => {
    it("starts blank and reacts to the name fields on every keystroke", async () => {
      const user = renderPanel();

      const avatar = () => screen.getByTestId("avatar-initials").textContent;
      expect(avatar()).toBe("");

      await user.type(screen.getByLabelText("first name"), "P");
      expect(avatar()).toBe("P");

      await user.type(screen.getByLabelText("first name"), "robe");
      expect(avatar()).toBe("PR");

      // One initial per part once both are present.
      await user.type(screen.getByLabelText("last name"), "One");
      expect(avatar()).toBe("PO");
    });

    it("is decorative, because the names are beside it", () => {
      renderPanel();

      expect(screen.getByTestId("avatar-initials")).toHaveAttribute("aria-hidden", "true");
    });
  });

  it("shows a live hint of what the password still needs", async () => {
    const user = renderPanel();
    const password = screen.getByLabelText("password");

    await user.type(password, "abc");

    expect(screen.getByText(/needs at least 8 characters, one number/i)).toBeInTheDocument();

    await user.type(password, "12345");
    await waitFor(() => {
      expect(screen.getByText(/long enough and mixes letters with numbers/i)).toBeInTheDocument();
    });
  });

  it("blocks submit on a confirm mismatch and never lets the password leave the browser", async () => {
    const user = renderPanel();

    await user.type(screen.getByLabelText("first name"), "Probe");
    await user.type(screen.getByLabelText("last name"), "One");
    await user.type(screen.getByLabelText("username"), "probe1");
    await user.type(screen.getByLabelText("email address"), "probe1@example.com");
    await user.click(screen.getByRole("combobox", { name: "country" }));
    await user.click(await screen.findByRole("option", { name: "India" }));
    await user.click(screen.getByRole("radio", { name: "other" }));
    await user.type(screen.getByLabelText("password"), PASSWORD);
    await user.type(screen.getByLabelText("confirm password"), "abc12346");
    await user.click(screen.getByRole("checkbox"));

    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();

    await user.click(submitButton());
    expect(signUp).not.toHaveBeenCalled();
  });

  it("sends exactly the fields the register contract lists", async () => {
    const user = renderPanel();
    signUp.mockResolvedValue(createAuthResult());

    await fillValidForm(user);
    await user.click(submitButton());

    await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));

    expect(signUp).toHaveBeenCalledWith({
      username: "probe1",
      email: "probe1@example.com",
      firstName: "Probe",
      lastName: "One",
      country: "IN",
      gender: Gender.OTHER,
      password: "abc12345",
    });

    // The confirmation and the consent flag are client-side only. Any property
    // outside the contract is a rejection, not something to ignore.
    const payload = signUp.mock.calls[0][0];
    expect(payload).not.toHaveProperty("confirmPassword");
    expect(payload).not.toHaveProperty("acceptedTerms");
  });

  it("does not normalise the username or email before sending", async () => {
    const user = renderPanel();
    signUp.mockResolvedValue(createAuthResult());

    await user.type(screen.getByLabelText("first name"), "Probe");
    await user.type(screen.getByLabelText("last name"), "One");
    await user.type(screen.getByLabelText("username"), "Probe1");
    await user.type(screen.getByLabelText("email address"), "Probe1@Example.COM");
    await user.click(screen.getByRole("combobox", { name: "country" }));
    await user.click(await screen.findByRole("option", { name: "India" }));
    await user.click(screen.getByRole("radio", { name: "other" }));
    await user.type(screen.getByLabelText("password"), PASSWORD);
    await user.type(screen.getByLabelText("confirm password"), PASSWORD);
    await user.click(screen.getByRole("checkbox"));
    await user.click(submitButton());

    await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));

    const payload = signUp.mock.calls[0][0];
    expect(payload.username).toBe("Probe1");
    expect(payload.email).toBe("Probe1@Example.COM");
  });

  it("attaches a taken username to the username field", async () => {
    const user = renderPanel();
    signUp.mockRejectedValue(createApiError(AuthErrorCode.USERNAME_TAKEN));

    await fillValidForm(user);
    await user.click(submitButton());

    expect(await screen.findByText(/username is already registered/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders every field the server reported at once", async () => {
    const user = renderPanel();
    signUp.mockRejectedValue(
      createApiError(AuthErrorCode.VALIDATION_FAILED, {
        details: [
          { field: "username", code: "field_taken", message: "Username is not available." },
          { field: "email", code: "field_invalid", message: "Email is not available." },
        ],
      })
    );

    await fillValidForm(user);
    await user.click(submitButton());

    expect(await screen.findByText("Username is not available.")).toBeInTheDocument();
    expect(screen.getByText("Email is not available.")).toBeInTheDocument();
  });

  it("keeps a whole-request problem on the banner", async () => {
    const user = renderPanel();
    signUp.mockRejectedValue(createApiError(AuthErrorCode.DATABASE_UNAVAILABLE));

    await fillValidForm(user);
    await user.click(submitButton());

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent(/briefly unavailable/i);
    expect(within(banner).queryByText(/database_unavailable/)).not.toBeInTheDocument();
  });

  it("links on to sign in", () => {
    renderPanel();

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });
});