import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">🦃 Turkey Research</h1>
          <p className="text-gray-400 mt-2">Create your account</p>
        </div>
        <SignUp />
      </div>
    </div>
  );
}
