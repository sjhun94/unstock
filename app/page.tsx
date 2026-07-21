import UnstockApp from "@/components/UnstockApp";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Unstock</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          비상장주식 세법상 가치평가 계산기
        </p>
      </div>
      <UnstockApp />
    </div>
  );
}
