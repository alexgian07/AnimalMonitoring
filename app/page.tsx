import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

export default async function Home() {
  const { userId } = await auth();
  // Ethogram is the default landing page for now; /dashboard still exists (type the URL).
  if (userId) redirect("/ethogram");
  else redirect("/sign-in");
}
