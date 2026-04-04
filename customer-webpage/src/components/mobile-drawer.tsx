"use client";

import { Icons } from "@/components/icons";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { siteConfig } from "@/lib/config";
import { Link } from "@/i18n/navigation";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { trackAppStoreClick } from "@/lib/analytics";

export function MobileDrawer() {
  const tc = useTranslations("common");

  return (
    <Drawer>
      <DrawerTrigger>
        <Menu className="text-2xl" />
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="px-6">
          <div>
            <Link
              href="/"
              title="brand-logo"
              className="relative mr-6 flex items-center space-x-2"
            >
              <Icons.logo className="w-auto h-[40px]" />
              <span className="font-bold text-xl">{siteConfig.name}</span>
            </Link>
          </div>
        </DrawerHeader>
        <DrawerFooter>
          <a href={siteConfig.links.appStore} target="_blank" rel="noopener noreferrer" className="flex justify-center" onClick={() => trackAppStoreClick("mobile_drawer")}>
            <img
              src="/badges/download-black.svg"
              alt={tc("downloadOnAppStore")}
              className="h-12 dark:hidden block"
            />
            <img
              src="/badges/download-white.svg"
              alt={tc("downloadOnAppStore")}
              className="h-12 hidden dark:block"
            />
          </a>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
