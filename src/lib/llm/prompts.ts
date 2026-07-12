export const ARCHITECTURE_REVIEWER_SYSTEM_PROMPT = `You are a collaborative system-design brainstorming partner embedded beside a diagram canvas.

Your job:
- Look at the provided architecture diagram image first.
- Ask useful clarifying questions.
- Identify assumptions, missing components, risks, bottlenecks, security/privacy concerns, and operational tradeoffs.
- Suggest improvements, but do not overstate certainty when the diagram is ambiguous.
- Reference visible diagram details when possible.
- Keep responses brief by default: 3-5 short bullets or under 120 words unless the user explicitly asks for detail.
- Keep proactive comments to one concise observation or one good question.
- For manual review, provide a structured but compact review.
- Never claim you can see details that are not visible. If the image is unclear, say so and use the metadata as secondary context.
- In Diagramming mode, return only one fenced JSON object that matches the diagram-plan contract in the user prompt. The app applies the plan directly to the opened Excalidraw file.`;

export function buildReviewPrompt(args: {
  userPrompt?: string;
  metadata: string;
  mode: 'manual' | 'proactive' | 'chat' | 'diagramming';
  thinkingLevel: 'off' | 'low' | 'medium' | 'high';
  scene: string;
}) {
  const base = args.userPrompt?.trim() || 'Review this architecture diagram.';
  const modeInstruction =
    args.mode === 'proactive'
      ? 'This is a proactive review after drawing inactivity. Be brief and non-intrusive: ask one question or make one actionable observation.'
      : args.mode === 'manual'
        ? 'This is a manual review request. Give a concise architecture review with questions, risks, and suggestions.'
        : args.mode === 'diagramming'
          ? 'This is a direct diagramming request. Return a valid executable diagram plan, not prose.'
          : 'Continue the conversation using the diagram image and metadata when relevant. Keep the answer compact.';
  const thinkingInstruction =
    args.thinkingLevel === 'off'
      ? 'Thinking level: off. Answer directly. Do not include hidden reasoning, chain-of-thought, scratchpad text, or <think>...</think> blocks in the response.'
      : `Thinking level: ${args.thinkingLevel}. Use that amount of internal reasoning, but only show the final concise answer.`;

  const diagramPlanInstruction = args.mode === 'diagramming'
    ? `\n\nFor an explicit create/edit request, respond with only this fenced JSON shape (otherwise respond normally):\n\`\`\`json\n{\n  "summary": "brief user-visible description",\n  "target": { "type": "current" },\n  "operations": [\n    { "type": "create", "elements": [{ "type": "rectangle", "x": 80, "y": 80, "width": 220, "height": 120, "label": { "text": "Service" } }] },\n    { "type": "update", "elementId": "existing-id", "patch": { "x": 120 } },\n    { "type": "style", "elementIds": ["existing-id"], "patch": { "strokeColor": "#1e1e1e" } },\n    { "type": "delete", "elementIds": ["existing-id"] },\n    { "type": "group", "elementIds": ["existing-id"] },\n    { "type": "order", "elementIds": ["existing-id"], "position": "front" },\n    { "type": "align", "elementIds": ["existing-id"], "axis": "left" }\n  ]\n}\n\`\`\`\nUse generic Excalidraw shapes, text, arrows, frames, groups, styling, ordering, and alignment. Use IDs only from the inspected scene. Always set the target to \`{ "type": "current" }\`; the plan is applied directly to the currently opened Excalidraw file. Never include commentary with a plan.`
    : '';

  return `${modeInstruction}\n${thinkingInstruction}${diagramPlanInstruction}\n\nUser request: ${base}\n\nInspected Excalidraw scene:\n${args.scene}\n\nSupporting Excalidraw metadata (secondary to the image):\n${args.metadata}`;
}
