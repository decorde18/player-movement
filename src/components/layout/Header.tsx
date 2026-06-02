"use client";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import TeamSelector from "./TeamSelector";
import { useState, useRef, useEffect } from "react";

import { User, UserCircle, ChevronDown } from "lucide-react";
import LoginButton from "@/components/ui/LoginButton";
import LogoutButton from "@/components/ui/LogoutButton";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Select from "@/components/ui/Select";

const DEV_USERS = [
  {
    value: "admin",
    label: "Admin User",
    user: {
      name: "Admin User",
      roles: { isAdmin: true },
      first_name: "Admin",
      last_name: "User",
    },
  },
  {
    value: "coach",
    label: "Coach User",
    user: {
      name: "Coach User",
      roles: { isAdmin: false },
      first_name: "Coach",
      last_name: "User",
    },
  },
  {
    value: "player",
    label: "Player User",
    user: {
      name: "Player User",
      roles: { isAdmin: false },
      first_name: "Player",
      last_name: "User",
    },
  },
];

interface HeaderUser {
  name?: string;
  roles?: {
    isAdmin?: boolean;
  };
  first_name?: string;
  last_name?: string;
}

function Header({ user }: { user?: HeaderUser }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [devUserMode, setDevUserMode] = useState<string>("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const devUserOverride = DEV_USERS.find(u => u.value === devUserMode)?.user;
  const currentUser = devUserOverride ?? (user as HeaderUser) ?? session?.user;
  const name = currentUser?.name ?? "Player";
  const isAdmin = currentUser?.roles?.isAdmin;
  const firstNameInitial = currentUser?.first_name
    ? currentUser.first_name[0]
    : (name?.[0] ?? "");
  const lastNameInitial = currentUser?.last_name
    ? currentUser.last_name[0]
    : "";
  const initials = `${firstNameInitial}${lastNameInitial}`.toUpperCase();
  const formattedDate = format(new Date(), "EEEE, MMMM d, yyyy");

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className='sticky top-0 z-50 border-b border-border bg-surface shadow-md items-center'>
      <div className='mx-auto flex h-16 w-full max-w-screen-2xl items-center gap-4 px-4 sm:px-6 lg:px-8'>
        {/* Logo Section */}
        <div className='flex items-center gap-3'>
          <div className='flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-md'>
            <User size={20} />
          </div>
          <div>
            <p className='text-sm font-bold text-text'>Soccer Stats</p>
            <p className='text-xs text-muted hidden sm:block'>
              {formattedDate}
            </p>
          </div>
        </div>

        {/* Team Selector */}
        <div className='flex-1 '>
          <TeamSelector type="header" />
        </div>

        {/* Right Section */}
        <div className='flex items-center gap-3'>
          {process.env.NODE_ENV === "development" && (
            <div className="hidden lg:block mr-2">
               <Select
                 options={[{value: "", label: "Real User"}, ...DEV_USERS]}
                 value={devUserMode}
                 onChange={(e: any) => setDevUserMode(e.target.value)}
                 width="auto"
                 className="min-w-[140px]"
                 showPlaceholder={false}
               />
            </div>
          )}
          {currentUser ? (
            <div className='relative' ref={dropdownRef}>
              {/* User Button */}
              <Button
                variant="outline"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className='hidden md:flex flex-row items-center gap-2 px-4 py-2 text-sm font-normal border-border bg-background hover:bg-primary/10'
              >
                <span className='inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white font-semibold text-xs'>
                  {initials || "U"}
                </span>
                <div className='min-w-0 text-left'>
                  <p className='truncate text-sm font-medium text-text'>
                    {name}
                  </p>
                  <p className='text-xs text-muted'>
                    {isAdmin ? "Admin" : "Member"}
                  </p>
                </div>
                <ChevronDown
                  size={16}
                  className={`text-muted transition-transform duration-200 ${
                    isDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </Button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <Card
                  variant='default'
                  padding='none'
                  className='absolute right-0 mt-2 w-48 shadow-lg'
                >
                  {/* User Info Header */}
                  <div className='border-b border-border bg-background px-4 py-3'>
                    <p className='text-sm font-semibold text-text'>{name}</p>
                    <p className='text-xs text-muted'>
                      {isAdmin ? "Administrator" : "Member"}
                    </p>
                  </div>

                  {/* Menu Items */}
                  <div className='p-2'>
                    <Button
                      variant="outline"
                      onClick={() => {
                        router.push("/profile");
                        setIsDropdownOpen(false);
                      }}
                      className='w-full flex flex-row items-center justify-start gap-2 px-3 py-2 border-none font-normal text-text hover:bg-primary/10 bg-transparent shadow-none'
                    >
                      <UserCircle size={16} className='text-primary' />
                      <span className='text-sm'>Profile</span>
                    </Button>
                    <div className='border-t border-border my-1' />
                    <LogoutButton
                      onLogout={() => setIsDropdownOpen(false)}
                      isDropdown={true}
                    />
                  </div>
                </Card>
              )}

              {/* Mobile User Avatar */}
              <Button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className='md:hidden flex items-center justify-center h-10 w-10 !p-0 rounded-full text-sm'
              >
                {initials || "U"}
              </Button>
            </div>
          ) : (
            <div className='flex items-center gap-2'>
              <LoginButton />
              <Link href='/auth/register' className='inline-flex'>
                <Button variant='secondary' size='sm'>
                  Register
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
