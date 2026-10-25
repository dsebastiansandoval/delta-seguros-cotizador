import { BranchGate } from "@/components/shared/BranchGate";

export default function Layout({ children }: LayoutProps<"/cotizar/salud">) {
  return <BranchGate branch="SALUD">{children}</BranchGate>;
}
