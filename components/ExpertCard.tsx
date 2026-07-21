import type { Expert } from "@/lib/experts";
import CopyableContact from "@/components/CopyableContact";

export default function ExpertCard({ expert }: { expert: Expert }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-950">
      <div className="flex items-center gap-4">
        {expert.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={expert.photoUrl}
            alt={expert.name}
            className="h-14 w-14 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white"
            style={{ backgroundColor: expert.avatarColor }}
          >
            {expert.initials}
          </div>
        )}
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

      <div className="flex flex-col gap-3 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-900">
        <div className="flex justify-between gap-2 text-zinc-600 dark:text-zinc-300">
          <span className="text-zinc-400 dark:text-zinc-500">사무실 위치</span>
          <span>{expert.officeLocation}</span>
        </div>
        <div className="flex flex-col gap-0.5 text-zinc-600 dark:text-zinc-300">
          <span className="text-zinc-400 dark:text-zinc-500">용역비용</span>
          <span>{expert.feeDescription}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <CopyableContact label="전화" value={expert.phone} />
        <CopyableContact label="이메일" value={expert.email} />
      </div>
    </div>
  );
}
