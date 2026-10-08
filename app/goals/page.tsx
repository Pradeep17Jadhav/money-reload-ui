import GoalsPage from "./GoalsPage";

const title = "Goals - MoneyReload";
const description = "Set saving goals and track how far along you are.";
const keywords = "saving goals, goal tracker, moneyreload goals";

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

export default GoalsPage;