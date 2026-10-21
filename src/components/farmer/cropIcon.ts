import { Bean, Citrus, Wheat } from "lucide-react";
import type { CommodityId } from "@/lib/domain/types";

export const CROP_ICON: Record<CommodityId, typeof Citrus> = { orange: Citrus, soybean: Bean, tur: Wheat };
