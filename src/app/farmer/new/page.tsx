"use client";

import { useApp } from "@/lib/store/AppProvider";
import { PageHeader } from "@/components/ui/primitives";
import { LotForm } from "@/components/farmer/LotForm";

export default function NewLotPage() {
  const { t } = useApp();
  return (
    <div>
      <PageHeader eyebrow={t("role.farmer")} title={t("form.title")} sub={t("form.sub")} />
      <LotForm />
    </div>
  );
}
