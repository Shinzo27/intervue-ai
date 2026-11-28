"use client";

import { useParams } from "next/navigation";
import { PipelineBuilder } from "@/components/pipelines/builder";

export default function PipelineBuilderPage() {
  const id = useParams<{ id: string }>()?.id;
  if (!id) return null;
  return <PipelineBuilder key={id} pipelineId={id} />;
}
