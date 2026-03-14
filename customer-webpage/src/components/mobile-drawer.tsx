import { Icons } from "@/components/icons";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { siteConfig } from "@/lib/config";
import Link from "next/link";
import { Menu } from "lucide-react";

export function MobileDrawer() {
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
          <Link href="#" className="flex justify-center">
            <img
              src="/badges/download-black.svg"
              alt="Download on the App Store"
              className="h-12 dark:hidden block"
            />
            <img
              src="/badges/download-white.svg"
              alt="Download on the App Store"
              className="h-12 hidden dark:block"
            />
          </Link>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
