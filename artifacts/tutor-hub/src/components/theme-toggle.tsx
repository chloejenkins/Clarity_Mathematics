import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Preference = "system" | "light" | "dark";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function readPreference(): Preference {
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* localStorage unavailable (private mode), fall back to the device */
  }
  return "system";
}

function systemIsDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia(DARK_QUERY).matches;
}

/**
 * Appearance follows the device's light/dark setting by default, the way
 * Apple's guidelines ask (dark-mode.md: people expect apps to respond to
 * their systemwide choice). People can still pin Light or Dark here, and
 * pick System to go back. The initial class is set in index.html before
 * paint to avoid a flash.
 */
export function ThemeToggle() {
  const [preference, setPreference] = useState<Preference>(readPreference);
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );

  useEffect(() => {
    const mql = window.matchMedia(DARK_QUERY);
    const apply = () => {
      const dark = preference === "dark" || (preference === "system" && mql.matches);
      document.documentElement.classList.toggle("dark", dark);
      setIsDark(dark);
    };
    apply();
    try {
      if (preference === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", preference);
    } catch {
      /* ignore */
    }
    if (preference !== "system") return;
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, [preference]);

  const Icon = preference === "system" ? Monitor : isDark ? Moon : Sun;
  const label =
    preference === "system"
      ? `Appearance: system (${systemIsDark() ? "dark" : "light"})`
      : `Appearance: ${preference}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          title={label}
          className="text-muted-foreground hover:text-foreground"
        >
          <Icon className="h-[18px] w-[18px]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          Appearance
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(v) => setPreference(v as Preference)}
        >
          <DropdownMenuRadioItem value="system">
            <Monitor className="mr-2 h-4 w-4" /> System
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">
            <Sun className="mr-2 h-4 w-4" /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="mr-2 h-4 w-4" /> Dark
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
