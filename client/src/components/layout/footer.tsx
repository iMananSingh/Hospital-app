export default function Footer() {
  return (
    <footer className="bg-background border-t border-[#e6e6e6] px-6">
      <div
        className="flex justify-between items-center text-[13px] text-[#6c757d] h-[35px]"
        style={{ letterSpacing: "0.2px" }}
      >
        <div>
          © 2025 HMSync · <span className="text-[#9ca3af]">Version 0.2.0</span>{" "}
          · Powered by HMSync Technologies
        </div>
        <div>
          Support:{" "}
          <a
            href="mailto:support@hmsync.in"
            className="text-[#007bff] no-underline hover:text-[#0056b3] hover:underline transition-colors duration-200"
          >
            support@hmsync.in
          </a>
        </div>
      </div>
    </footer>
  );
}
