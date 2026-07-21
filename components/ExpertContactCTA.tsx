// TODO: 실제 연락처가 정해지면 아래 플레이스홀더를 교체하세요.
const CONTACT_EMAIL = "contact@unstock.example";

export default function ExpertContactCTA() {
  const subject = encodeURIComponent("Unstock 비상장주식 평가 상담 요청");
  const mailtoHref = `mailto:${CONTACT_EMAIL}?subject=${subject}`;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          더 정확한 평가가 필요하신가요?
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          이 계산기는 참고용 수치를 제공합니다. 실제 신고나 거래에 활용하시려면 회계사·세무사와
          상담해 정확한 평가를 받아보세요.
        </p>
      </div>
      <a href={mailtoHref} className="btn-secondary self-start">
        전문가에게 상담 요청하기
      </a>
    </div>
  );
}
