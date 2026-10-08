import ExpensesPage from "./ExpensesPage";

const title = "Expenses - MoneyReload";
const description = "Track what you spend each month.";
const keywords = "track expenses, expense tracker, moneyreload expenses";

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

export default ExpensesPage;