import { NextResponse } from "next/server";
import {
  analyzeImageForAgent,
  formatVisionAnalysesForAgent,
  maxVisionImageBytes,
  type AgentVisionAnalysis
} from "@/lib/agent/vision";
import { env } from "@/lib/env";

const maxImagesPerRequest = 4;

function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

function getFiles(formData: FormData) {
  return formData.getAll("images").filter((item): item is File => item instanceof File);
}

export async function POST(request: Request) {
  if (!env.aliyunBailianApiKey) {
    return NextResponse.json({ error: "Missing ALIYUN_BAILIAN_API_KEY for image analysis." }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const userMessage = String(formData.get("message") ?? "");
    const files = getFiles(formData).slice(0, maxImagesPerRequest);

    if (!files.length) {
      return NextResponse.json({ error: "Upload at least one image for analysis." }, { status: 400 });
    }

    const analyses: AgentVisionAnalysis[] = [];

    for (const file of files) {
      if (!isImageFile(file)) {
        return NextResponse.json({ error: "Only image uploads can be analyzed." }, { status: 400 });
      }

      if (file.size > maxVisionImageBytes) {
        return NextResponse.json({ error: "Image file is too large. Please upload images under 8MB." }, { status: 400 });
      }

      const bytes = Buffer.from(await file.arrayBuffer());
      analyses.push(
        await analyzeImageForAgent({
          fileName: file.name,
          contentType: file.type || "image/jpeg",
          imageBase64: bytes.toString("base64"),
          userMessage
        })
      );
    }

    return NextResponse.json({
      analyses,
      agent_context: formatVisionAnalysesForAgent(analyses)
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to analyze image uploads." },
      { status: 500 }
    );
  }
}
