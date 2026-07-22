import { SignIn } from "@clerk/nextjs";
import { t } from "@/lib/i18n";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">{t.auth.title}</h1>
          <p className="text-gray-400 mt-2">{t.auth.signInSubtitle}</p>
        </div>
        <SignIn forceRedirectUrl="/ethogram" />
      </div>
    </div>
  );
}
