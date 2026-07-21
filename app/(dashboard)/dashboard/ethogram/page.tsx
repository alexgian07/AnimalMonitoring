import EthogramClient from "./EthogramClient";

export default function EthogramPage() {
  const commitEnabled =
    !!process.env.GSHEET_ID && !!process.env.GOOGLE_CREDENTIALS;
  return <EthogramClient commitEnabled={commitEnabled} />;
}
