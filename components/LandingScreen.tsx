const FEATURES = [
  "상속세 및 증여세법 시행령 제54조 기준 보충적 평가방법 적용",
  "회원가입 없이 바로 이용 가능",
  "몇 단계만 입력하면 1주당·총 평가액을 바로 확인",
];

export default function LandingScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-8 rounded-2xl border border-black/10 bg-white p-10 text-center shadow-sm dark:border-white/10 dark:bg-zinc-950">
      <div className="flex flex-col items-center gap-3">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          비상장주식, 세법상 가치가 궁금하신가요?
        </h2>
        <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          회사의 재무 정보만 입력하면 현행 세법 기준으로 1주당 평가액을 계산해드려요.
        </p>
      </div>

      <ul className="flex w-full flex-col gap-2 text-left">
        {FEATURES.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-300"
          >
            <span className="mt-0.5 text-zinc-400 dark:text-zinc-500">✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <button onClick={onStart} className="btn-primary w-full sm:w-auto sm:px-10">
        시작하기
      </button>
    </div>
  );
}
