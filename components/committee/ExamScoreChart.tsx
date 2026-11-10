"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ExamScoreChart({
  math,
  english,
  logic,
  computer,
}: {
  math: number;
  english: number;
  logic: number;
  computer: number;
}) {
  const data = [
    { subject: "Math", score: math },
    { subject: "English", score: english },
    { subject: "Logic", score: logic },
    { subject: "Computer", score: computer },
  ];

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="subject" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="score" name="Score" fill="#2563eb" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
