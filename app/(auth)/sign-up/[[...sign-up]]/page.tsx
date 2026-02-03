import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Join Saqr</h1>
          <p className="text-zinc-400 mt-2">Create your account</p>
          <p className="text-zinc-500 text-sm mt-1" dir="rtl">إنشاء حسابك في صقر</p>
        </div>
        <SignUp
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "bg-zinc-900 border border-zinc-800",
              headerTitle: "text-white",
              headerSubtitle: "text-zinc-400",
              socialButtonsBlockButton: "bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700",
              formFieldLabel: "text-zinc-300",
              formFieldInput: "bg-zinc-800 border-zinc-700 text-white",
              footerActionLink: "text-amber-400 hover:text-amber-300",
              formButtonPrimary: "bg-amber-500 hover:bg-amber-400 text-black",
            },
          }}
        />
      </div>
    </div>
  );
}
