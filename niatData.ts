import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { NIAT_CAMPUSES } from "@/data/niatData";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Tool 1: Query structured NIAT database
function lookupCampusMatches(args: { preferredState?: string; maxFourYearBudgetINR: number }) {
  const { preferredState, maxFourYearBudgetINR } = args;
  let matches = NIAT_CAMPUSES.filter((c) => c.fourYearTuitionINR <= maxFourYearBudgetINR * 1.15);

  if (preferredState && preferredState !== "Any") {
    const stateMatches = matches.filter(
      (c) => c.state.toLowerCase() === preferredState.toLowerCase()
    );
    if (stateMatches.length > 0) matches = stateMatches;
  }

  return matches.slice(0, 3);
}

// Tool 2: Compute deterministic ROI, scholarship & payback math
function calculateRoiAndScholarship(args: {
  fourYearTuitionINR: number;
  annualHostelINR: number;
  examPercentile: number;
  avgPlacementLPA: number;
}) {
  const { fourYearTuitionINR, annualHostelINR, examPercentile, avgPlacementLPA } = args;

  let scholarshipPct = 15;
  if (examPercentile >= 95) scholarshipPct = 50;
  else if (examPercentile >= 88) scholarshipPct = 35;
  else if (examPercentile >= 75) scholarshipPct = 25;

  const scholarshipSavingsINR = Math.round((fourYearTuitionINR * scholarshipPct) / 100);
  const netTuitionINR = fourYearTuitionINR - scholarshipSavingsINR;
  const totalHostel4YrINR = annualHostelINR * 4;
  const totalOutOfPocketINR = netTuitionINR + totalHostel4YrINR;
  const annualSalaryINR = avgPlacementLPA * 100000;
  const paybackYears = Number((totalOutOfPocketINR / annualSalaryINR).toFixed(1));

  return {
    estimatedNatScholarshipPct: scholarshipPct,
    scholarshipSavingsINR,
    netFourYearTuitionINR: netTuitionINR,
    totalFourYearHostelINR: totalHostel4YrINR,
    totalOutOfPocket4YrINR: totalOutOfPocketINR,
    estimatedStartingCTC_LPA: avgPlacementLPA,
    estimatedPaybackPeriodYears: paybackYears
  };
}

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "lookup_campus_matches",
      description: "Look up matching NIAT partner universities based on state preference and 4-year tuition budget.",
      parameters: {
        type: "object",
        properties: {
          preferredState: { type: "string", description: "State name or 'Any'" },
          maxFourYearBudgetINR: { type: "number", description: "Max 4-year tuition budget in INR" }
        },
        required: ["maxFourYearBudgetINR"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "calculate_roi_and_scholarship",
      description: "Calculate exact NAT scholarship savings, total 4-year out-of-pocket fee, and salary payback period.",
      parameters: {
        type: "object",
        properties: {
          fourYearTuitionINR: { type: "number" },
          annualHostelINR: { type: "number" },
          examPercentile: { type: "number" },
          avgPlacementLPA: { type: "number" }
        },
        required: ["fourYearTuitionINR", "annualHostelINR", "examPercentile", "avgPlacementLPA"]
      }
    }
  }
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, leadProfile, messages } = body;

    const systemPrompt = `You are the NIAT AI Family Counselor & Admissions Strategist.
CRITICAL FACTS ABOUT NIAT:
- NIAT (NxtWave of Innovation in Advanced Technologies) is NOT a university itself; it is a 4-year industry-upskilling overlay delivered inside 35+ UGC-approved partner universities.
- Students receive a UGC-recognized B.Tech degree from the host university + NxtWave's AI/ML & full-stack training and placement support.
- Always call lookup_campus_matches and calculate_roi_and_scholarship before quoting any numbers. Never guess fees.
- Write the response strictly in the parent's preferred language: ${leadProfile.language} (if Telugu, Tamil, or Hindi, use native script with clear English numbers/terms like B.Tech, UGC, LPA, INR so parents can read easily).
- Tone: Empathetic, transparent, reassuring to anxious parents, structured with bullet points.`;

    const conversation: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...(mode === "generate_brief"
        ? [
            {
              role: "user" as const,
              content: `Generate a personalized "Rank-to-Reality & Parent Clarity Brief" for:
Student: ${leadProfile.studentName}
Exam & Percentile: ${leadProfile.examName} (${leadProfile.percentile}%ile)
Preferred State: ${leadProfile.preferredState}
4-Year Tuition Budget: ₹${leadProfile.budgetLakhs} Lakhs (${leadProfile.budgetLakhs * 100000} INR)
Parent Preferred Language: ${leadProfile.language}

1. Briefly show the "Rank-to-Reality" truth: at ${leadProfile.percentile}%ile in ${leadProfile.examName}, top NITs/IIITs CS seats are out of reach, whereas traditional tier-3 private colleges teach outdated syllabi.
2. Call your tools to find the top matching NIAT partner campus(es) and calculate exact post-scholarship 4-year costs + payback period.
3. Clarify the dual-enrollment structure (UGC-valid B.Tech from host university + NIAT industry overlay) so parents have zero confusion.`
            }
          ]
        : messages)
    ];

    let toolTrace: Array<{ tool: string; output: unknown }> = [];
    let response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: conversation,
      tools: TOOLS,
      tool_choice: "auto",
      temperature: 0.4
    });

    let msg = response.choices[0].message;

    // Handle tool calls loop
    while (msg.tool_calls && msg.tool_calls.length > 0) {
      conversation.push(msg);
      for (const toolCall of msg.tool_calls) {
        if (toolCall.type !== "function") continue;
        const fnName = toolCall.function.name;
        const fnArgs = JSON.parse(toolCall.function.arguments);
        let result: unknown;

        if (fnName === "lookup_campus_matches") {
          result = lookupCampusMatches(fnArgs);
        } else if (fnName === "calculate_roi_and_scholarship") {
          result = calculateRoiAndScholarship(fnArgs);
        }

        toolTrace.push({ tool: fnName, output: result });
        conversation.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }

      response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: conversation,
        tools: TOOLS,
        temperature: 0.4
      });
      msg = response.choices[0].message;
    }

    const finalReply = msg.content || "Unable to generate response.";

    // Component 3: Fire Automation Webhook (Make.com / n8n / CRM) on initial brief generation
    const webhookPayload = {
      event: "niat_parent_brief_generated",
      timestamp: new Date().toISOString(),
      leadScore: leadProfile.percentile >= 85 && leadProfile.budgetLakhs >= 10 ? "HOT_PRIORITY" : "WARM_NURTURE",
      leadProfile,
      toolCalculations: toolTrace,
      generatedParentBrief: finalReply
    };

    let webhookStatus = "Simulated (Add AUTOMATION_WEBHOOK_URL in .env.local for live Make/n8n push)";
    if (process.env.AUTOMATION_WEBHOOK_URL) {
      try {
        const whRes = await fetch(process.env.AUTOMATION_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(webhookPayload)
        });
        webhookStatus = whRes.ok ? "Delivered to Make/n8n CRM Webhook (200 OK)" : `Webhook Error (${whRes.status})`;
      } catch {
        webhookStatus = "Webhook unreachable";
      }
    }

    return NextResponse.json({
      reply: finalReply,
      toolTrace,
      webhookStatus,
      webhookPayload
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
