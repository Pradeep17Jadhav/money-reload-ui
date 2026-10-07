import RegisterPage from "./RegisterPage";

const title = "Create your MoneyReload account";
const description =
  "Create a MoneyReload account to track your loans, income, expenses and financial goals in one place.";
const keywords = "moneyreload register, create account, moneyreload sign up, track loans and expenses";

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

export default RegisterPage;