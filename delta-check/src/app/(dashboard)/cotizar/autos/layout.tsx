import { BranchGate } from "@/components/shared/BranchGate";

export default function Layout({ children }: LayoutProps<"/cotizar/autos">) {
  return <BranchGate branch="AUTOS">{children}</BranchGate>;
}
