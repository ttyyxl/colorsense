export function FooterGradient() {
  return (
    <footer className="relative mt-2 overflow-hidden border-t border-white/50 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(244,248,254,0.72))]">
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,rgba(120,137,170,0),rgba(120,137,170,0.42),rgba(120,137,170,0))]" />
      <div className="relative mx-auto flex w-full max-w-7xl flex-col items-center justify-center px-6 py-4 text-center">
        <p className="text-sm font-light tracking-[0.18em] text-[#667694]">ColorSense · 色彩慢慢淡出，灵感继续延展</p>
        <p className="mt-1 text-[11px] font-light tracking-[0.14em] text-[#8f9bb2]/70">© 2026 Color Lab. Built by ZCR×LYX.</p>
      </div>
    </footer>
  );
}
