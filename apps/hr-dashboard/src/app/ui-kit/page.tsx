import { notFound } from "next/navigation";
import { UiKit } from "./ui-kit";

export const metadata = { title: "UI kit" };

/** Dev-only gallery of every @repo/ui component and state, in both themes. */
export default function UiKitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiKit />;
}
