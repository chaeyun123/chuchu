import { hasUploadAccess, hasViewAccess } from "@/lib/auth";
import { listAlbums, listAllPhotos, photoDay, type Photo } from "@/lib/drive";
import Locked from "@/components/Locked";
import Calendar from "@/components/Calendar";

export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  if (!(await hasViewAccess())) return <Locked />;
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }); // YYYY-MM-DD
  const { m } = await searchParams;
  const month = m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : today.slice(0, 7);

  const [all, albums, canEdit] = await Promise.all([listAllPhotos(), listAlbums(), hasUploadAccess()]);

  // 이번 달 사진을 날짜별로 묶기 + 사진이 있는 달 목록
  const days: Record<string, Photo[]> = {};
  const months: Record<string, number> = {};
  for (const p of all) {
    const d = photoDay(p);
    months[d.slice(0, 7)] = (months[d.slice(0, 7)] ?? 0) + 1;
    if (d.startsWith(month)) (days[d] ??= []).push(p);
  }
  for (const list of Object.values(days)) {
    list.sort((a, b) => (a.takenAt ?? a.createdTime).localeCompare(b.takenAt ?? b.createdTime));
  }

  return (
    <main className="wrap narrow">
      <Calendar
        month={month}
        today={today}
        days={days}
        months={Object.entries(months).sort(([a], [b]) => b.localeCompare(a))}
        canEdit={canEdit}
        albums={albums.map((a) => ({ id: a.id, name: a.name }))}
      />
    </main>
  );
}
