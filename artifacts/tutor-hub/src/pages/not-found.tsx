import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="min-h-dvh w-full flex items-center justify-center bg-background px-6">
      <div className="max-w-sm text-center">
        <Logo showWordmark={false} className="text-foreground" style={{ fontSize: "1rem" }} />
        <h1 className="mt-6 page-title">
          Page not found
        </h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          That link may be out of date. Your schedule, messages and assignments are all on the home page.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Go to home</Link>
        </Button>
      </div>
    </div>
  );
}
