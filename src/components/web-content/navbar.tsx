import Image from "next/image";
import Link from "next/link";
import React from "react";
import { LuChevronDown, LuChevronRight } from "react-icons/lu";
import { Button } from "../ui/button";

const NavbarWeb = () => {
  return (
    <nav className="bg-white flex items-center justify-between px-4">
      {/* LOGO */}
      <div className="flex items-center  cursor-pointer">
        <Link href="/web">
          <Image
            src="/clarioBlack.png"
            alt="logo"
            width={80}
            height={80}
            className=""
          />
        </Link>

        <h1 className="font-raleway text-3xl font-bold -ml-2">Mentlio</h1>
      </div>

      {/* NAV LINKS */}
      <ul className="flex items-center gap-6 font-inter font-extralight tracking-wide text-muted-foreground">
        <li>
          <a href="/web#services" className="flex items-center gap-2">Services <LuChevronDown /></a>
        </li>
        <li>
          <a href="/web#about">About us</a>
        </li>
        <li>
          <Link href="/home/settings/billing">Pricing</Link>
        </li>
      </ul>

      <div className="">
        <Link href="/auth">
          <Button className="bg-blue-500 hover:bg-blue-700 text-white font-medium font-inter py-2 px-4 rounded-full">
            Get Started <LuChevronRight />
          </Button>
        </Link>
      </div>
    </nav>
  );
};

export default NavbarWeb;
