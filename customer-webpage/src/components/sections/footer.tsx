import { Icons } from "@/components/icons";
import { siteConfig } from "@/lib/config";

type FooterLink = {
  text: string;
  url: string;
};

const links: FooterLink[] = [
  { text: "Features", url: "#features" },
  { text: "Pricing", url: "#pricing" },
  { text: "FAQ", url: "#faq" },
  { text: "Blog", url: "/blog" },
  { text: "Privacy", url: "/privacy" },
  { text: "Terms", url: "/terms" },
];

export function Footer() {
  return (
    <footer className="flex flex-col gap-y-5 px-7 py-5 md:px-10 w-full max-w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-x-2">
          <Icons.logo className="h-5 w-5" />
          <h2 className="text-lg font-bold text-foreground">
            {siteConfig.name}
          </h2>
        </div>

        <div className="flex gap-x-2">
          <a
            href={siteConfig.links.twitter}
            className="flex h-5 w-5 items-center justify-center text-muted-foreground transition-all duration-100 ease-linear hover:text-foreground"
          >
            <Icons.twitter className="fill-current" />
          </a>
        </div>
      </div>
      <div className="flex flex-col justify-between gap-y-5 md:flex-row md:items-center">
        <ul className="flex flex-col gap-x-5 gap-y-2 text-muted-foreground md:flex-row md:items-center">
          {links.map((link, index) => (
            <li
              key={index}
              className="text-[15px]/normal font-medium text-muted-foreground transition-all duration-100 ease-linear hover:text-foreground hover:underline hover:underline-offset-4"
            >
              <a href={link.url}>{link.text}</a>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between text-sm font-medium tracking-tight text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Vector Expense. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
