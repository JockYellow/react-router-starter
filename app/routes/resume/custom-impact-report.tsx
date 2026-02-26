export default function CustomImpactReportPage() {
  return (
    <section className="mx-auto w-full max-w-[1200px] px-2 md:px-4 pb-8">
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_16px_40px_rgba(10,20,40,0.12)]">
        <iframe
          title="Custom Impact Report"
          src="/resume/custom-impact-report/raw"
          className="block h-[80vh] min-h-[680px] w-full"
        />
      </div>
    </section>
  );
}
