"use client";

import { useParams } from "next/navigation";
import { RecommendationView } from "@/components/farmer/RecommendationView";

export default function LotRecommendationPage() {
  const params = useParams<{ id: string }>();
  return <RecommendationView lotId={decodeURIComponent(params.id)} />;
}
