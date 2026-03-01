"use client";

// dynamic() with ssr:false must live inside a Client Component.
// layout.tsx is a Server Component (needs metadata exports), so we wrap
// the dynamic import here and re-export it as a plain client wrapper.
import dynamic from "next/dynamic";

const EvoluClientProvider = dynamic(
  () => import("@/components/EvoluClientProvider"),
  { ssr: false },
);

export default function EvoluNoSSR({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EvoluClientProvider>{children}</EvoluClientProvider>;
}
