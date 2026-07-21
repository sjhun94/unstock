import type { Expert } from "@/lib/experts";

export default function ExpertCard({ expert }: { expert: Expert }) {
  const subject = encodeURIComponent("Unstock 비상장주식 평가 상담 요청");

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
      <div className="flex items-center gap-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white"
          style={{ backgroundColor: expert.avatarColor }}
        >
          {expert.initials}
        </div>
        <div>
          <p className="font-semibold text-zinc-900 dark:text-zinc-50">
            {expert.name} <span className="font-normal text-zinc-500 dark:text-zinc-400">· {expert.role}</span>
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {expert.affiliation} · 경력 {expert.experienceYears}년
          </p>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{expert.bio}</p>

      <div className="flex flex-wrap gap-2">
        {expert.specialties.map((specialty) => (
          <span
            key={specialty}
            className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {specialty}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-1 text-sm text-zinc-500 dark:text-zinc-400">
        <span>{expert.phone}</span>
        <span>{expert.email}</span>
      </div>

      <a href={`mailto:${expert.email}?subject=${subject}`} className="btn-primary text-center">
        상담 요청하기
      </a>
    </div>
  );
}
