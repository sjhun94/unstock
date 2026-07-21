import Link from "next/link";
import ExpertCard from "@/components/ExpertCard";
import { experts } from "@/lib/experts";

export const metadata = {
  title: "전문가 상담 — Unstock",
};

export default function ExpertsPage() {
  return (
    <div className="flex flex-1 flex-col items-center gap-8 bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="flex w-full max-w-3xl flex-col gap-2">
        <Link href="/" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
          ← 계산기로 돌아가기
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          전문가 상담
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          비상장주식 가치평가 경험이 있는 회계사·세무사에게 정확한 평가를 상담받아보세요.
        </p>
      </div>

      <div className="grid w-full max-w-3xl gap-6 sm:grid-cols-2">
        {experts.map((expert) => (
          <ExpertCard key={expert.id} expert={expert} />
        ))}
      </div>
    </div>
  );
}
