import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppBar from "@/components/AppBar/AppBar";
import { useAuth } from "@/contexts/authContext";
import type { AuthStatus } from "@/types/AuthTypes";
import { createAuthUser } from "@/tests/factories/authFactories";

const push = jest.fn();
const signOut = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push, replace: jest.fn() }),
}));

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

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

jest.mock("@/contexts/authContext", () => ({
  useAuth: jest.fn(),
}));

// The real provider looks the visitor's country up over the network on mount.
jest.mock("@/contexts/currency", () => ({
  useCurrency: () => ({ currency: "USD", isINR: false, setCurrency: jest.fn() }),
}));

const mockUseAuth = useAuth as unknown as jest.Mock;

const setAuth = (status: AuthStatus) => {
  const isSignedIn = status === "authenticated";

  mockUseAuth.mockReturnValue({
    status,
    user: isSignedIn ? createAuthUser() : null,
    isSignedIn,
    sessionRestoreMessage: null,
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut,
  });
};

const toolsTrigger = () => screen.getByRole("button", { name: "Tools" });

/** Toolbar destinations. A tooltip replaces each link's accessible name. */
const toolbarLinks = () =>
  screen.getAllByRole("link").map((link) => link.getAttribute("href"));

describe("AppBar", () => {
  beforeEach(() => {
    push.mockReset();
    signOut.mockReset();
  });

  describe("signed out", () => {
    beforeEach(() => {
      setAuth("unauthenticated");
    });

    it("lists every tool on the toolbar", () => {
      render(<AppBar />);

      expect(toolbarLinks()).toEqual(
        expect.arrayContaining([
          "/calculators",
          "/blog",
          "/sip-calculator",
          "/lumpsum-calculator",
          "/fd-calculator",
          "/rd-calculator",
          "/mortgage-calculator",
        ])
      );

      // Income Tax is INR only, so it stays out for everyone else.
      expect(toolbarLinks()).not.toContain("/income-tax-calculator");
    });

    it("offers a single sign-in action, with no separate registration one", () => {
      render(<AppBar />);

      expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
      expect(screen.queryByRole("link", { name: /create account/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: /create account/i })).not.toBeInTheDocument();
    });

    it("keeps the tools flat rather than behind a menu", () => {
      render(<AppBar />);

      expect(screen.queryByRole("button", { name: "Tools" })).not.toBeInTheDocument();
    });
  });

  describe("signed in", () => {
    beforeEach(() => {
      setAuth("authenticated");
    });

    it("replaces the individual tool links with one item", () => {
      render(<AppBar />);

      expect(toolsTrigger()).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Calculators" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Blog" })).not.toBeInTheDocument();
    });

    it("expands the tool links on hover and collapses them again", async () => {
      const user = userEvent.setup();
      render(<AppBar />);

      expect(toolsTrigger()).toHaveAttribute("aria-expanded", "false");

      await user.hover(toolsTrigger());

      expect(toolsTrigger()).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByRole("link", { name: "Calculators" })).toHaveAttribute("href", "/calculators");
      expect(screen.getByRole("link", { name: "Fixed Deposit" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Mortgage" })).toBeInTheDocument();

      await user.unhover(toolsTrigger());

      expect(toolsTrigger()).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("link", { name: "Calculators" })).not.toBeInTheDocument();
    });

    it("leaves no sign-out button on the toolbar itself", () => {
      render(<AppBar />);

      expect(screen.queryByRole("button", { name: /sign out/i })).not.toBeInTheDocument();
      expect(screen.queryByText("Probe One")).not.toBeInTheDocument();
    });

    it("shows the account and the sign-out action from the profile icon", async () => {
      const user = userEvent.setup();
      render(<AppBar />);

      await user.click(screen.getByRole("button", { name: "Account" }));

      expect(screen.getByText("PO")).toBeInTheDocument();
      expect(screen.getByText("Probe One")).toBeInTheDocument();
      expect(screen.getByText("@probe1")).toBeInTheDocument();
      expect(screen.getByText("probe1@example.com")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /sign out/i }));

      expect(signOut).toHaveBeenCalledTimes(1);
      expect(push).toHaveBeenCalledWith("/");
    });
  });

  describe("account pages", () => {
    it("lists the signed-in user's own pages on the toolbar", () => {
      setAuth("authenticated");
      render(<AppBar />);

      expect(toolbarLinks()).toEqual(
        expect.arrayContaining([
          "/loans",
          "/income",
          "/expenses",
          "/goals",
          "/profile",
        ])
      );
    });

    it("places them after Tools, so the tools come first", () => {
      setAuth("authenticated");
      render(<AppBar />);

      const hrefs = toolbarLinks();
      const firstAccountLink = hrefs.indexOf("/profile");

      expect(firstAccountLink).toBeGreaterThan(0);
      expect(hrefs.slice(firstAccountLink)).toEqual([
        "/profile",
        "/loans",
        "/income",
        "/expenses",
        "/investments",
        "/goals",
      ]);
    });

    it("hides every one of them while signed out", () => {
      setAuth("unauthenticated");
      render(<AppBar />);

      for (const path of ["/loans", "/income", "/expenses", "/goals", "/profile"]) {
        expect(toolbarLinks()).not.toContain(path);
      }
    });

    it("keeps them out of the Tools menu, so no destination is listed twice", async () => {
      const user = userEvent.setup();
      setAuth("authenticated");
      render(<AppBar />);

      await user.hover(toolsTrigger());

      /*
       * Scoped to the Tools panel. The account links sit on the toolbar either way, so
       * asking about every link on the page would always find them and prove nothing.
       */
      const panel = toolsTrigger().closest("div");
      const toolsPanelHrefs = within(panel as HTMLElement)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href"));

      expect(toolsPanelHrefs).toContain("/calculators");
      for (const path of ["/loans", "/income", "/expenses", "/goals", "/profile"]) {
        expect(toolsPanelHrefs).not.toContain(path);
      }
    });

    it("does not treat a restored session as signed in yet", () => {
      // `initialising` means the stored token has not been verified. Showing the
      // account links here would advertise pages that are about to redirect.
      setAuth("initialising");
      render(<AppBar />);

      for (const path of ["/loans", "/income", "/expenses", "/goals", "/profile"]) {
        expect(toolbarLinks()).not.toContain(path);
      }
    });
  });
});