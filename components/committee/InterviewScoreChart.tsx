"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export function InterviewScoreChart({
  communication,
  leadership,
  motivation,
  confidence,
  criticalThinking,
}: {
  communication: number;
  leadership: number;
  motivation: number;
  confidence: number;
  criticalThinking: number;
}) {
  const data = [
    { category: "Communication", score: communication },
    { category: "Leadership", score: leadership },
    { category: "Motivation", score: motivation },
    { category: "Confidence", score: confidence },
    { category: "Critical Thinking", score: criticalThinking },
  ];

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Radar name="Score" dataKey="score" stroke="#16a34a" fill="#16a34a" fillOpacity={0.4} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
