"use client";

export function MarketingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-bg py-8">
      <div className="mx-auto max-w-4xl px-6">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {/* Brand */}
          <div>
            <h3 className="font-semibold text-fg">RushRank</h3>
            <p className="mt-2 text-sm text-muted">
              Modern rush management for fraternities.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-fg">Product</h4>
            <ul className="mt-2 space-y-1 text-sm text-muted">
              <li>
                <a href="#" className="hover:text-accent-fg transition">
                  Features
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-accent-fg transition">
                  Demo
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-accent-fg transition">
                  Pricing
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-semibold text-fg">Company</h4>
            <ul className="mt-2 space-y-1 text-sm text-muted">
              <li>
                <a href="#" className="hover:text-accent-fg transition">
                  About
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-accent-fg transition">
                  Blog
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-accent-fg transition">
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-8">
          <p className="text-center text-sm text-muted">
            &copy; {currentYear} RushRank. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
