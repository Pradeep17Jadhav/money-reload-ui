import LoginPage from "./LoginPage";

const title = "Sign in - MoneyReload";
const description =
  "Sign in to MoneyReload to track your loans, income, expenses and financial goals in one place.";
const keywords = "moneyreload login, sign in, moneyreload account, track loans and expenses";

export const metadata = {
  title,
  description,
  keywords,
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    description,
    keywords,
  },
};

export default LoginPage;