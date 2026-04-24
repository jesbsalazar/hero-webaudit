import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "HERO OS — Free AI Funnel Audit" },
      {
        name: "description",
        content:
          "Get a free AI-powered audit of your sales page using the HERO Method. Score, opportunities, and a redesigned mockup in 60 seconds.",
      },
      { property: "og:title", content: "HERO OS — Free AI Funnel Audit" },
      {
        property: "og:description",
        content: "Score your funnel with AI and get a redesigned mockup in 60 seconds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "HERO OS — Free AI Funnel Audit" },
      { name: "description", content: "Our Project Builder creates a comprehensive website analysis report and AI mockups." },
      { property: "og:description", content: "Our Project Builder creates a comprehensive website analysis report and AI mockups." },
      { name: "twitter:description", content: "Our Project Builder creates a comprehensive website analysis report and AI mockups." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/46acb533-7581-4a9c-b561-06036ab0da27/id-preview-70b56b96--f5ee4276-2d14-4a29-962b-bf726b5eb73d.lovable.app-1776812604572.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/46acb533-7581-4a9c-b561-06036ab0da27/id-preview-70b56b96--f5ee4276-2d14-4a29-962b-bf726b5eb73d.lovable.app-1776812604572.png" },
      { property: "og:url", content: "https://hero-webaudit.lovable.app/" },
      { property: "og:site_name", content: "HERO OS" },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "canonical", href: "https://hero-webaudit.lovable.app/" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "HERO OS — Free AI Funnel Audit",
          url: "https://hero-webaudit.lovable.app/",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description:
            "Get a free AI-powered audit of your sales page using the HERO Method. Score, opportunities, and a redesigned mockup in 60 seconds.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <I18nProvider>
      <Outlet />
      <Toaster richColors position="top-center" />
    </I18nProvider>
  );
}
