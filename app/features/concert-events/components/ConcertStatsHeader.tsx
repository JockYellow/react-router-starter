type ConcertStatsHeaderProps = {
  total: number;
  firstSeen: string;
  lastSeen: string;
};

export const ConcertStatsHeader = ({ total, firstSeen, lastSeen }: ConcertStatsHeaderProps) => (
  <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">演出監控</p>
        <h1 className="text-2xl font-semibold text-slate-900">演出資料庫控制台</h1>
        <p className="text-sm text-slate-500">來源：KKTIX · iNDIEVOX · 表：concert_event · 總筆數：{total}</p>
      </div>
      <div className="text-sm text-slate-500">
        <div>首次發現：{firstSeen}</div>
        <div>最後更新：{lastSeen}</div>
      </div>
    </div>
  </header>
);
