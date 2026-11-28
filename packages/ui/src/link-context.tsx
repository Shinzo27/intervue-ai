"use client";

import { createContext, useContext, type AnchorHTMLAttributes, type ComponentType } from "react";

export type LinkComponent = ComponentType<
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
>;

const LinkContext = createContext<LinkComponent>(function Anchor(props) {
  return <a {...props} />;
});

/**
 * Lets shared navigation render the app's router link (e.g. next/link)
 * without @repo/ui depending on a framework.
 */
export const LinkProvider = LinkContext.Provider;

export function useLinkComponent(): LinkComponent {
  return useContext(LinkContext);
}
