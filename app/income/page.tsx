import IncomePage from "./IncomePage";
import { getConfig } from "@/helpers/config";

const title = "Income - MoneyReload";
const description = "Track the income you receive each month.";
const keywords = "track income, income tracker, moneyreload income";

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

/**
 * The page reads its own config, because the income-tax budgets are what an imported income's
 * figures are resolved against — and a client cannot be handed a config it does not need. The
 * config is already loaded and cached for the whole app, so this costs no extra request.
 */
const Page = async () => {
  const config = await getConfig();

  return <IncomePage incomeTaxConfig={config.incomeTax} />;
};

export default Page;